"""
네이버 검색 결과에서 뉴스 기사를 크롤링하는 PyQt6 GUI 앱.

네이버는 일반 requests 라이브러리의 TLS 핑거프린트를 차단(403)하므로,
실제 브라우저의 TLS 시그니처를 흉내내는 curl_cffi를 사용해 페이지를 받아온 뒤
BeautifulSoup4로 파싱한다. 네트워크 작업은 QThread에서 실행해 UI가 멈추지 않도록 한다.

필요 패키지:
    pip install curl_cffi beautifulsoup4 PyQt6 openpyxl
"""

import csv
import re
import sys
import urllib.parse

from curl_cffi import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from PyQt6.QtCore import QThread, pyqtSignal
from PyQt6.QtWidgets import (
    QApplication,
    QFileDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

IMPERSONATE = "chrome120"

# 기사 링크는 n.news.naver.com/mnews/article/{언론사코드}/{기사번호} 형태
ARTICLE_LINK_RE = re.compile(r"https://n\.news\.naver\.com/mnews/article/\d+/\d+(\?[^\"'>\s]*)?")


def build_search_url(query: str) -> str:
    """검색어로 네이버 통합검색 URL을 생성한다."""
    encoded = urllib.parse.quote(query)
    return f"https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query={encoded}"


def get_article_links(search_url: str) -> list[str]:
    """검색 결과 페이지에서 네이버뉴스 기사 링크만 추출(중복 제거)한다."""
    res = requests.get(search_url, impersonate=IMPERSONATE, timeout=10)
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")
    links = set()

    for a in soup.select("a[href]"):
        href = a["href"]
        if ARTICLE_LINK_RE.match(href):
            links.add(href)

    # 검색 결과 페이지는 스크립트 내부에도 기사 URL을 포함하는 경우가 있어 보완 검색
    for match in ARTICLE_LINK_RE.finditer(res.text):
        links.add(match.group(0))

    return list(links)


def crawl_article(url: str) -> dict | None:
    """네이버뉴스 기사 페이지에서 제목/언론사/날짜/본문을 추출한다."""
    try:
        res = requests.get(url, impersonate=IMPERSONATE, timeout=10)
        res.raise_for_status()
    except Exception:
        return None

    soup = BeautifulSoup(res.text, "html.parser")

    title_tag = soup.select_one("#title_area span")
    press_tag = soup.select_one(".media_end_head_top_press")
    date_tag = soup.select_one(".media_end_head_info_datestamp_time")
    body_tag = soup.select_one("#dic_area")

    if not title_tag or not body_tag:
        return None

    # 본문 내 불필요한 요소(사진 설명, 스크립트 등) 제거
    for tag in body_tag.select("script, style, .end_photo_org, .img_desc"):
        tag.decompose()

    return {
        "url": url,
        "title": title_tag.get_text(strip=True),
        "press": press_tag.get_text(strip=True) if press_tag else "",
        "date": date_tag.get_text(strip=True) if date_tag else "",
        "content": body_tag.get_text("\n", strip=True),
    }


class CrawlWorker(QThread):
    """검색 + 기사 크롤링을 백그라운드 스레드에서 수행한다."""

    article_crawled = pyqtSignal(dict)
    progress = pyqtSignal(int, int)
    error = pyqtSignal(str)
    finished_all = pyqtSignal()

    def __init__(self, query: str):
        super().__init__()
        self.query = query

    def run(self):
        try:
            search_url = build_search_url(self.query)
            links = get_article_links(search_url)
        except Exception as e:
            self.error.emit(f"검색 결과를 가져오지 못했습니다.\n{e}")
            self.finished_all.emit()
            return

        total = len(links)
        for i, link in enumerate(links, 1):
            article = crawl_article(link)
            if article:
                self.article_crawled.emit(article)
            self.progress.emit(i, total)

        self.finished_all.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("네이버 뉴스 크롤러")
        self.resize(1100, 650)

        self.articles: list[dict] = []
        self.worker: CrawlWorker | None = None

        self._build_ui()

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)

        # 검색 바
        search_bar = QHBoxLayout()
        self.query_edit = QLineEdit()
        self.query_edit.setPlaceholderText("검색어를 입력하세요 (예: 반도체)")
        self.query_edit.returnPressed.connect(self.start_crawl)
        self.search_btn = QPushButton("검색")
        self.search_btn.clicked.connect(self.start_crawl)
        self.save_btn = QPushButton("CSV로 저장")
        self.save_btn.clicked.connect(self.save_csv)
        self.save_btn.setEnabled(False)
        self.excel_btn = QPushButton("엑셀로 저장")
        self.excel_btn.clicked.connect(self.save_excel)
        self.excel_btn.setEnabled(False)
        search_bar.addWidget(QLabel("검색어:"))
        search_bar.addWidget(self.query_edit)
        search_bar.addWidget(self.search_btn)
        search_bar.addWidget(self.save_btn)
        search_bar.addWidget(self.excel_btn)
        root.addLayout(search_bar)

        # 본문 영역: 좌측 기사 목록 / 우측 본문 미리보기
        body = QHBoxLayout()

        self.table = QTableWidget(0, 3)
        self.table.setHorizontalHeaderLabels(["제목", "언론사", "날짜"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.itemSelectionChanged.connect(self.show_selected_article)
        body.addWidget(self.table, 5)

        self.content_view = QTextEdit()
        self.content_view.setReadOnly(True)
        body.addWidget(self.content_view, 4)

        root.addLayout(body, 1)

        # 상태 표시줄
        status_bar = QHBoxLayout()
        self.status_label = QLabel("검색어를 입력하고 검색 버튼을 누르세요.")
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        status_bar.addWidget(self.status_label, 1)
        status_bar.addWidget(self.progress_bar, 1)
        root.addLayout(status_bar)

    def start_crawl(self):
        query = self.query_edit.text().strip()
        if not query:
            QMessageBox.warning(self, "알림", "검색어를 입력하세요.")
            return

        if self.worker and self.worker.isRunning():
            return

        self.articles.clear()
        self.table.setRowCount(0)
        self.content_view.clear()
        self.save_btn.setEnabled(False)
        self.excel_btn.setEnabled(False)

        self.search_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setText(f"'{query}' 검색 결과에서 기사 링크를 가져오는 중...")

        self.worker = CrawlWorker(query)
        self.worker.article_crawled.connect(self.add_article)
        self.worker.progress.connect(self.update_progress)
        self.worker.error.connect(self.show_error)
        self.worker.finished_all.connect(self.crawl_finished)
        self.worker.start()

    def add_article(self, article: dict):
        self.articles.append(article)
        row = self.table.rowCount()
        self.table.insertRow(row)
        self.table.setItem(row, 0, QTableWidgetItem(article["title"]))
        self.table.setItem(row, 1, QTableWidgetItem(article["press"]))
        self.table.setItem(row, 2, QTableWidgetItem(article["date"]))

    def update_progress(self, done: int, total: int):
        self.progress_bar.setMaximum(max(total, 1))
        self.progress_bar.setValue(done)
        self.status_label.setText(f"기사 크롤링 중... ({done}/{total})")

    def show_error(self, message: str):
        QMessageBox.critical(self, "오류", message)

    def crawl_finished(self):
        self.search_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.status_label.setText(f"완료: {len(self.articles)}건의 기사를 수집했습니다.")
        self.save_btn.setEnabled(len(self.articles) > 0)
        self.excel_btn.setEnabled(len(self.articles) > 0)

    def show_selected_article(self):
        rows = self.table.selectionModel().selectedRows()
        if not rows:
            return
        article = self.articles[rows[0].row()]
        self.content_view.setPlainText(
            f"{article['title']}\n"
            f"{article['press']} | {article['date']}\n"
            f"{article['url']}\n"
            f"{'-' * 40}\n\n"
            f"{article['content']}"
        )

    def save_csv(self):
        if not self.articles:
            return
        path, _ = QFileDialog.getSaveFileName(self, "CSV로 저장", "naver_news.csv", "CSV Files (*.csv)")
        if not path:
            return
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=["url", "title", "press", "date", "content"])
            writer.writeheader()
            writer.writerows(self.articles)
        QMessageBox.information(self, "저장 완료", f"{len(self.articles)}건을 '{path}'에 저장했습니다.")

    def save_excel(self):
        if not self.articles:
            return
        path, _ = QFileDialog.getSaveFileName(self, "엑셀로 저장", "naver_news.xlsx", "Excel Files (*.xlsx)")
        if not path:
            return
        if not path.lower().endswith(".xlsx"):
            path += ".xlsx"

        headers = ["제목", "언론사", "날짜", "URL", "본문"]
        keys = ["title", "press", "date", "url", "content"]
        widths = [40, 12, 18, 45, 80]

        wb = Workbook()
        ws = wb.active
        ws.title = "네이버뉴스"
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)

        for article in self.articles:
            ws.append([article[key] for key in keys])

        for col_letter, width in zip("ABCDE", widths):
            ws.column_dimensions[col_letter].width = width
        for row in ws.iter_rows(min_row=2):
            row[4].alignment = Alignment(wrap_text=True)

        try:
            wb.save(path)
        except Exception as e:
            QMessageBox.critical(self, "오류", f"엑셀 파일 저장에 실패했습니다.\n{e}")
            return

        QMessageBox.information(self, "저장 완료", f"{len(self.articles)}건을 '{path}'에 저장했습니다.")


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
