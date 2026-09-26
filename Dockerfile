FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Сначала зависимости — чтобы слой кэшировался, пока requirements.txt не менялся.
# psycopg2-binary ставится готовым wheel'ом, libpq-dev и компилятор не нужны.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Запускаем через flask CLI, а не через `python app.py`:
# блок `if __name__ == "__main__": app.run(debug=True)` слушает только
# 127.0.0.1 и из контейнера был бы недоступен. init_db() вызывается при
# импорте app.py, поэтому app.py менять не нужно.
CMD ["flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "5000"]
