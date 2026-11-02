import yfinance as yf
import pandas as pd
import datetime

# 시작 날짜와 종료 날짜 설정
start_date = datetime.datetime(2000, 1, 1)
end_date = datetime.datetime(2023, 11, 30)

# Yahoo Finance에서 코스피 지수 데이터 가져오기
kospi_data = yf.download('^KS11', start=start_date, end=end_date)

# CSV 파일로 저장
kospi_data.to_csv('kospi_data.csv')

print("코스피 지수 데이터를 CSV 파일로 저장했습니다.")
