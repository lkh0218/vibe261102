"""
네이버 금융(finance.naver.com) 지수 페이지의 '편입종목상위' 표를 크롤링하는 PyQt6 GUI 앱.

대상 페이지: https://finance.naver.com/sise/sise_index.naver?code=KPI200
'편입종목상위' 표는 위 페이지 안에 iframe으로 삽입되어 있으며, 실제 데이터는
https://finance.naver.com/sise/entryJongmok.naver?type=KPI200 에서 페이지 단위로 내려온다.
이 앱은 iframe의 실제 데이터 URL을 페이지별로 순회하며 전 종목을 수집한다.
네트워크 작업은 QThread에서 실행해 UI가 멈추지 않도록 한다.

필요 패키지:
    pip install requests beautifulsoup4 PyQt6 openpyxl
"""

import csv
import re
import sys

import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook
from openpyxl.styles import Font
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
    QVBoxLayout,
    QWidget,
)

BASE_URL = "https://finance.naver.com/sise/entryJongmok.naver"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}

COLUMNS = [
    ("code", "종목코드"),
    ("name", "종목명"),
    ("price", "현재가"),
    ("change", "전일비"),
    ("change_rate", "등락률"),
    ("volume", "거래량"),
    ("trade_amount_million", "거래대금(백만)"),
    ("market_cap_100million", "시가총액(억)"),
]


def _fetch(index_code: str, page: int) -> BeautifulSoup:
    res = requests.get(
        BASE_URL, params={"type": index_code, "page": page}, headers=HEADERS, timeout=10
    )
    res.raise_for_status()
    res.encoding = "euc-kr"  # 네이버 금융 옛 페이지는 EUC-KR 인코딩을 사용
    return BeautifulSoup(res.text, "html.parser")


def get_total_pages(index_code: str) -> int:
    """페이지 하단 네비게이션에서 마지막 페이지 번호를 구한다."""
    soup = _fetch(index_code, 1)
    nav = soup.select_one("table.Nnavi")
    if not nav:
        return 1
    pages = [int(m.group(1)) for a in nav.select("a[href*='page=']")
             if (m := re.search(r"page=(\d+)", a["href"]))]
    return max(pages) if pages else 1


def parse_page(soup: BeautifulSoup) -> list[dict]:
    """편입종목상위 표 한 페이지 분량을 파싱한다."""
    stocks = []
    for tr in soup.select("table.type_1 tr"):
        name_tag = tr.select_one("td.ctg a")
        if not name_tag:
            continue

        code = re.search(r"code=(\d+)", name_tag["href"]).group(1)
        name = name_tag.get_text(strip=True)

        cells = tr.select("td")
        price = cells[1].get_text(strip=True)

        # 전일비 칸은 "하락"/"상승" 안내 문구(span.blind)와 숫자가 함께 있어 분리해서 부호를 붙인다.
        change_cell = cells[2]
        blind = change_cell.select_one("span.blind")
        direction = blind.get_text(strip=True) if blind else ""
        if blind:
            blind.decompose()
        change = change_cell.get_text(strip=True)
        if direction == "하락":
            change = f"-{change}"
        elif direction == "상승":
            change = f"+{change}"

        change_rate = cells[3].get_text(strip=True)
        volume = cells[4].get_text(strip=True)
        trade_amount = cells[5].get_text(strip=True)
        market_cap = cells[6].get_text(strip=True)

        stocks.append({
            "code": code,
            "name": name,
            "price": price,
            "change": change,
            "change_rate": change_rate,
            "volume": volume,
            "trade_amount_million": trade_amount,
            "market_cap_100million": market_cap,
        })
    return stocks


class CrawlWorker(QThread):
    """전 페이지 크롤링을 백그라운드 스레드에서 수행한다."""

    page_crawled = pyqtSignal(list)
    progress = pyqtSignal(int, int)
    error = pyqtSignal(str)
    finished_all = pyqtSignal()

    def __init__(self, index_code: str):
        super().__init__()
        self.index_code = index_code

    def run(self):
        try:
            total_pages = get_total_pages(self.index_code)
        except Exception as e:
            self.error.emit(f"지수 코드를 확인해주세요.\n{e}")
            self.finished_all.emit()
            return

        for page in range(1, total_pages + 1):
            try:
                soup = _fetch(self.index_code, page)
                stocks = parse_page(soup)
            except Exception as e:
                self.error.emit(f"{page}페이지를 가져오지 못했습니다.\n{e}")
                continue
            self.page_crawled.emit(stocks)
            self.progress.emit(page, total_pages)

        self.finished_all.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("네이버 금융 편입종목상위 크롤러")
        self.resize(950, 650)

        self.stocks: list[dict] = []
        self.worker: CrawlWorker | None = None

        self._build_ui()

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)

        # 검색 바
        search_bar = QHBoxLayout()
        self.code_edit = QLineEdit("KPI200")
        self.code_edit.setPlaceholderText("지수 코드를 입력하세요 (예: KPI200)")
        self.code_edit.returnPressed.connect(self.start_crawl)
        self.search_btn = QPushButton("조회")
        self.search_btn.clicked.connect(self.start_crawl)
        self.save_btn = QPushButton("CSV로 저장")
        self.save_btn.clicked.connect(self.save_csv)
        self.save_btn.setEnabled(False)
        self.excel_btn = QPushButton("엑셀로 저장")
        self.excel_btn.clicked.connect(self.save_excel)
        self.excel_btn.setEnabled(False)
        search_bar.addWidget(QLabel("지수 코드:"))
        search_bar.addWidget(self.code_edit)
        search_bar.addWidget(self.search_btn)
        search_bar.addWidget(self.save_btn)
        search_bar.addWidget(self.excel_btn)
        root.addLayout(search_bar)

        # 종목 테이블
        self.table = QTableWidget(0, len(COLUMNS))
        self.table.setHorizontalHeaderLabels([label for _, label in COLUMNS])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        root.addWidget(self.table, 1)

        # 상태 표시줄
        status_bar = QHBoxLayout()
        self.status_label = QLabel("지수 코드를 입력하고 조회 버튼을 누르세요.")
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        status_bar.addWidget(self.status_label, 1)
        status_bar.addWidget(self.progress_bar, 1)
        root.addLayout(status_bar)

    def start_crawl(self):
        index_code = self.code_edit.text().strip()
        if not index_code:
            QMessageBox.warning(self, "알림", "지수 코드를 입력하세요.")
            return

        if self.worker and self.worker.isRunning():
            return

        self.stocks.clear()
        self.table.setRowCount(0)
        self.save_btn.setEnabled(False)
        self.excel_btn.setEnabled(False)

        self.search_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setText(f"'{index_code}' 편입종목상위를 조회하는 중...")

        self.worker = CrawlWorker(index_code)
        self.worker.page_crawled.connect(self.add_page)
        self.worker.progress.connect(self.update_progress)
        self.worker.error.connect(self.show_error)
        self.worker.finished_all.connect(self.crawl_finished)
        self.worker.start()

    def add_page(self, stocks: list[dict]):
        for stock in stocks:
            self.stocks.append(stock)
            row = self.table.rowCount()
            self.table.insertRow(row)
            for col, (key, _) in enumerate(COLUMNS):
                self.table.setItem(row, col, QTableWidgetItem(stock[key]))

    def update_progress(self, done: int, total: int):
        self.progress_bar.setMaximum(max(total, 1))
        self.progress_bar.setValue(done)
        self.status_label.setText(f"페이지 수집 중... ({done}/{total})")

    def show_error(self, message: str):
        QMessageBox.critical(self, "오류", message)

    def crawl_finished(self):
        self.search_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.status_label.setText(f"완료: {len(self.stocks)}건의 종목을 수집했습니다.")
        self.save_btn.setEnabled(len(self.stocks) > 0)
        self.excel_btn.setEnabled(len(self.stocks) > 0)

    def save_csv(self):
        if not self.stocks:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "CSV로 저장", "naver_index_top_stocks.csv", "CSV Files (*.csv)"
        )
        if not path:
            return
        keys = [key for key, _ in COLUMNS]
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(self.stocks)
        QMessageBox.information(self, "저장 완료", f"{len(self.stocks)}건을 '{path}'에 저장했습니다.")

    def save_excel(self):
        if not self.stocks:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "엑셀로 저장", "naver_index_top_stocks.xlsx", "Excel Files (*.xlsx)"
        )
        if not path:
            return
        if not path.lower().endswith(".xlsx"):
            path += ".xlsx"

        keys = [key for key, _ in COLUMNS]
        headers = [label for _, label in COLUMNS]

        wb = Workbook()
        ws = wb.active
        ws.title = "편입종목상위"
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)

        for stock in self.stocks:
            ws.append([stock[key] for key in keys])

        for col_letter in [chr(ord("A") + i) for i in range(len(COLUMNS))]:
            ws.column_dimensions[col_letter].width = 16

        try:
            wb.save(path)
        except Exception as e:
            QMessageBox.critical(self, "오류", f"엑셀 파일 저장에 실패했습니다.\n{e}")
            return

        QMessageBox.information(self, "저장 완료", f"{len(self.stocks)}건을 '{path}'에 저장했습니다.")


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
