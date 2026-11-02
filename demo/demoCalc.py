def calculate(a, b, operator):
    if operator == "+":
        return a + b
    if operator == "-":
        return a - b
    if operator == "*":
        return a * b
    if operator == "/":
        if b == 0:
            return "0으로 나눌 수 없습니다."
        return a / b
    return "지원하지 않는 연산자입니다. (+, -, *, / 사용)"


def main():
    print("간단한 사칙연산 계산기")
    print("종료하려면 연산자 입력 시 q를 입력하세요.")

    while True:
        try:
            a = float(input("첫 번째 숫자: "))
            operator = input("연산자 (+, -, *, /): ").strip()

            if operator.lower() == "q":
                print("계산기를 종료합니다.")
                break

            b = float(input("두 번째 숫자: "))
            result = calculate(a, b, operator)
            print(f"결과: {result}\n")
        except ValueError:
            print("숫자를 올바르게 입력해주세요.\n")


if __name__ == "__main__":
    main()
