"""
컬리(Kurly) 상품 상세페이지의 리뷰(댓글)를 약 300개 수집한 뒤 Pandas로 감성(긍정/부정/중립)을
분류하고, matplotlib 파이차트로 비율을 보여주는 PyQt6 GUI 앱.

대상 페이지 예: https://www.kurly.com/goods/1000969096?collectionCode=sale231107
컬리 PDP는 Next.js SPA라 리뷰가 HTML에 전부 담겨있지 않고, 브라우저가 아래 내부 API를
호출해 커서 기반(after 파라미터)으로 페이지네이션한다(Playwright로 실제 네트워크 요청을
캡처해 확인함):
    GET https://api.kurly.com/product-review/v4/contents-products/{productNo}/reviews
        ?sortType=RECENTLY&size=40&onlyImage=false&after={cursor}

감성 분류는 별도의 평점(별점) 필드가 응답에 없어 간단한 한국어 긍/부정 키워드 사전 기반으로
판단한다. 부정어 처리(예: "안 질기고")까지는 반영하지 않은 근사치 분류임을 감안할 것.

필요 패키지:
    pip install requests pandas matplotlib PyQt6 openpyxl
"""

import re
import sys
import time

import matplotlib
import pandas as pd
import requests
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
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
    QSpinBox,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

matplotlib.rcParams["font.family"] = "Malgun Gothic"  # 한글 표시를 위한 폰트 지정
matplotlib.rcParams["axes.unicode_minus"] = False

REVIEW_API = "https://api.kurly.com/product-review/v4/contents-products/{}/reviews"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

POSITIVE_WORDS = [
    "맛있", "좋아", "좋았", "좋네", "최고", "만족", "훌륭", "부드럽", "신선", "촉촉",
    "재구매", "또 구매", "또구매", "또 살", "재주문", "감사", "추천", "든든", "합리적",
    "가성비", "빠른배송", "빨라요", "친절", "완벽", "고급", "풍부", "쫄깃", "육즙",
    "감동", "성공", "예뻐요", "깔끔", "편해요", "잘 먹", "잘먹", "믿고", "안심하고",
    "저렴", "굿", "짱", "행복",
]
NEGATIVE_WORDS = [
    "별로", "실망", "불만", "아쉽", "비려", "비린내", "질기", "질겨", "퍽퍽", "냄새나",
    "비싸", "부족", "늦게", "늦었", "파손", "상함", "상했", "썩", "물렁", "느끼",
    "짜요", "짜다", "싱거", "딱딱", "환불", "교환", "불친절", "최악", "짜증", "후회",
    "다시는", "안살", "안 살", "노맛", "맛없", "역하",
]


def extract_product_no(url: str) -> int:
    """상품 URL에서 상품번호(productCode)를 추출한다."""
    m = re.search(r"/goods/(\d+)", url)
    if not m:
        raise ValueError("URL에서 상품번호를 찾을 수 없습니다. 예: https://www.kurly.com/goods/1000969096")
    return int(m.group(1))


def fetch_review_page(product_no: int, after: str | None, size: int = 40) -> dict:
    params = {"sortType": "RECENTLY", "size": size, "onlyImage": "false"}
    if after:
        params["after"] = after
    res = requests.get(REVIEW_API.format(product_no), params=params, headers=HEADERS, timeout=10)
    res.raise_for_status()
    return res.json()["data"]


def classify_sentiment(text: str) -> str:
    """간단한 키워드 매칭 기반 감성 분류(긍정/부정/중립)."""
    pos = sum(1 for w in POSITIVE_WORDS if w in text)
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    if pos > neg:
        return "긍정"
    if neg > pos:
        return "부정"
    return "중립"


class CrawlWorker(QThread):
    """리뷰 수집을 백그라운드 스레드에서 수행한다."""

    batch_fetched = pyqtSignal(list)
    progress = pyqtSignal(int, int)
    error = pyqtSignal(str)
    finished_all = pyqtSignal()

    def __init__(self, product_url: str, target: int):
        super().__init__()
        self.product_url = product_url
        self.target = target

    def run(self):
        try:
            product_no = extract_product_no(self.product_url)
        except ValueError as e:
            self.error.emit(str(e))
            self.finished_all.emit()
            return

        collected = 0
        after = None
        while collected < self.target:
            try:
                data = fetch_review_page(product_no, after)
            except Exception as e:
                self.error.emit(f"리뷰를 가져오지 못했습니다.\n{e}")
                break

            batch = data.get("reviews") or []
            if not batch:
                break

            remaining = self.target - collected
            if len(batch) > remaining:
                batch = batch[:remaining]

            self.batch_fetched.emit(batch)
            collected += len(batch)
            self.progress.emit(collected, self.target)

            after = (data.get("nextCursor") or {}).get("after")
            if not after or after == "0_0":
                break
            time.sleep(0.2)  # 서버 부하를 줄이기 위한 요청 간 대기

        self.finished_all.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("컬리 리뷰 감성 분석기")
        self.resize(1200, 700)

        self.reviews: list[dict] = []
        self.df: pd.DataFrame | None = None
        self.worker: CrawlWorker | None = None

        self._build_ui()

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)

        # 상단 입력 바
        top_bar = QHBoxLayout()
        self.url_edit = QLineEdit(
            "https://www.kurly.com/goods/1000969096?collectionCode=sale231107"
        )
        self.count_spin = QSpinBox()
        self.count_spin.setRange(10, 2000)
        self.count_spin.setSingleStep(10)
        self.count_spin.setValue(300)
        self.start_btn = QPushButton("수집 및 분석")
        self.start_btn.clicked.connect(self.start_crawl)
        self.save_csv_btn = QPushButton("CSV로 저장")
        self.save_csv_btn.clicked.connect(self.save_csv)
        self.save_csv_btn.setEnabled(False)
        self.save_excel_btn = QPushButton("엑셀로 저장")
        self.save_excel_btn.clicked.connect(self.save_excel)
        self.save_excel_btn.setEnabled(False)
        top_bar.addWidget(QLabel("상품 URL:"))
        top_bar.addWidget(self.url_edit, 1)
        top_bar.addWidget(QLabel("수집 개수:"))
        top_bar.addWidget(self.count_spin)
        top_bar.addWidget(self.start_btn)
        top_bar.addWidget(self.save_csv_btn)
        top_bar.addWidget(self.save_excel_btn)
        root.addLayout(top_bar)

        # 본문: 좌측 리뷰 테이블 / 우측 파이차트
        splitter = QSplitter()

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["내용", "작성자", "작성일", "좋아요", "감성"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        splitter.addWidget(self.table)

        self.figure = Figure(figsize=(5, 5))
        self.canvas = FigureCanvasQTAgg(self.figure)
        splitter.addWidget(self.canvas)
        splitter.setSizes([700, 500])

        root.addWidget(splitter, 1)

        # 상태 표시줄
        status_bar = QHBoxLayout()
        self.status_label = QLabel("상품 URL과 수집 개수를 확인하고 '수집 및 분석' 버튼을 누르세요.")
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        status_bar.addWidget(self.status_label, 1)
        status_bar.addWidget(self.progress_bar, 1)
        root.addLayout(status_bar)

    def start_crawl(self):
        url = self.url_edit.text().strip()
        if not url:
            QMessageBox.warning(self, "알림", "상품 URL을 입력하세요.")
            return

        if self.worker and self.worker.isRunning():
            return

        self.reviews.clear()
        self.df = None
        self.table.setRowCount(0)
        self.figure.clear()
        self.canvas.draw()
        self.save_csv_btn.setEnabled(False)
        self.save_excel_btn.setEnabled(False)

        self.start_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setText("리뷰를 수집하는 중...")

        target = self.count_spin.value()
        self.worker = CrawlWorker(url, target)
        self.worker.batch_fetched.connect(self.add_batch)
        self.worker.progress.connect(self.update_progress)
        self.worker.error.connect(self.show_error)
        self.worker.finished_all.connect(self.crawl_finished)
        self.worker.start()

    def add_batch(self, batch: list[dict]):
        for review in batch:
            self.reviews.append(review)
            row = self.table.rowCount()
            self.table.insertRow(row)
            self.table.setItem(row, 0, QTableWidgetItem(review.get("contents", "")))
            self.table.setItem(row, 1, QTableWidgetItem(review.get("ownerName", "")))
            self.table.setItem(row, 2, QTableWidgetItem(review.get("registeredAt", "")))
            self.table.setItem(row, 3, QTableWidgetItem(str(review.get("likeCount", 0))))
            self.table.setItem(row, 4, QTableWidgetItem(""))  # 감성은 분석 후 채움

    def update_progress(self, done: int, total: int):
        self.progress_bar.setMaximum(max(total, 1))
        self.progress_bar.setValue(done)
        self.status_label.setText(f"리뷰 수집 중... ({done}/{total})")

    def show_error(self, message: str):
        QMessageBox.critical(self, "오류", message)

    def crawl_finished(self):
        self.start_btn.setEnabled(True)
        self.progress_bar.setVisible(False)

        if not self.reviews:
            self.status_label.setText("수집된 리뷰가 없습니다.")
            return

        self.analyze_and_plot()
        self.status_label.setText(f"완료: 리뷰 {len(self.reviews)}건을 수집·분석했습니다.")
        self.save_csv_btn.setEnabled(True)
        self.save_excel_btn.setEnabled(True)

    def analyze_and_plot(self):
        df = pd.DataFrame(self.reviews)
        df["sentiment"] = df["contents"].apply(classify_sentiment)
        self.df = df

        # 테이블의 감성 컬럼 채우기
        for row, sentiment in enumerate(df["sentiment"]):
            self.table.setItem(row, 4, QTableWidgetItem(sentiment))

        counts = df["sentiment"].value_counts()
        labels = ["긍정", "부정", "중립"]
        values = [int(counts.get(label, 0)) for label in labels]
        colors = ["#4CAF50", "#E53935", "#9E9E9E"]

        # 데이터가 없는 감성은 파이차트에서 제외
        plot_labels = [l for l, v in zip(labels, values) if v > 0]
        plot_values = [v for v in values if v > 0]
        plot_colors = [c for c, v in zip(colors, values) if v > 0]

        self.figure.clear()
        ax = self.figure.add_subplot(111)
        ax.pie(
            plot_values,
            labels=plot_labels,
            colors=plot_colors,
            autopct="%1.1f%%",
            startangle=90,
        )
        ax.set_title(f"리뷰 감성 분석 (총 {len(df)}건)")
        ax.axis("equal")
        self.canvas.draw()

    def save_csv(self):
        if self.df is None:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "CSV로 저장", "kurly_reviews.csv", "CSV Files (*.csv)"
        )
        if not path:
            return
        self.df.to_csv(path, index=False, encoding="utf-8-sig")
        QMessageBox.information(self, "저장 완료", f"{len(self.df)}건을 '{path}'에 저장했습니다.")

    def save_excel(self):
        if self.df is None:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "엑셀로 저장", "kurly_reviews.xlsx", "Excel Files (*.xlsx)"
        )
        if not path:
            return
        if not path.lower().endswith(".xlsx"):
            path += ".xlsx"
        try:
            self.df.to_excel(path, index=False, engine="openpyxl")
        except Exception as e:
            QMessageBox.critical(self, "오류", f"엑셀 파일 저장에 실패했습니다.\n{e}")
            return
        QMessageBox.information(self, "저장 완료", f"{len(self.df)}건을 '{path}'에 저장했습니다.")


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
