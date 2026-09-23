CREATE TABLE Country (
    id INTEGER PRIMARY KEY,
    name VARCHAR
);

CREATE TABLE Company (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    country INTEGER,
FOREIGN KEY (country) REFERENCES Country(id)
);

CREATE TABLE Trip (
    id INTEGER PRIMARY KEY,
    company INTEGER,
    plane VARCHAR,
    town_from VARCHAR,
    town_to VARCHAR,
    time_out TIMESTAMP,
    time_in TIMESTAMP,
    distance INTEGER,
FOREIGN KEY (company) REFERENCES Company(id)
);

CREATE TABLE Passenger (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    birth_date DATE
);

CREATE TABLE Pass_in_trip (
    id INTEGER PRIMARY KEY,
    trip INTEGER,
    passenger INTEGER,
    place VARCHAR,
    class VARCHAR,
    price INTEGER,
FOREIGN KEY (trip) REFERENCES Trip(id),
FOREIGN KEY (passenger) REFERENCES Passenger(id)
);

-- ---------- Тестовые данные ----------

INSERT INTO Country (id, name) VALUES
(1, 'Russia'),
(2, 'France'),
(3, 'Germany'),
(4, 'USA');

INSERT INTO Company (id, name, country) VALUES
(1, 'Aeroflot', 1),
(2, 'Air France', 2),
(3, 'Lufthansa', 3),
(4, 'S7 Airlines', 1),
(5, 'Delta', 4);

INSERT INTO Trip (id, company, plane, town_from, town_to, time_out, time_in, distance) VALUES
(1101, 1, 'Boeing-777', 'Moscow', 'Paris', '2024-04-29 14:30', '2024-04-29 17:50', 2489),
(1102, 1, 'Boeing-777', 'Paris', 'Moscow', '2024-04-30 09:15', '2024-04-30 13:40', 2489),
(1103, 2, 'Airbus-320', 'Paris', 'Berlin', '2024-05-01 08:00', '2024-05-01 09:30', 878),
(1104, 3, 'Airbus-320', 'Berlin', 'Moscow', '2024-05-02 11:00', '2024-05-02 14:20', 1610),
(1105, 4, 'Boeing-737', 'Moscow', 'Berlin', '2024-05-03 06:45', '2024-05-03 09:10', 1610),
(1106, 5, 'Boeing-767', 'Moscow', 'New York', '2024-05-04 20:00', '2024-05-05 00:30', 7500),
(1107, 1, 'Boeing-777', 'Moscow', 'New York', '2024-05-05 21:00', '2024-05-06 01:20', 7500),
(1108, 3, 'Airbus-320', 'Moscow', 'Berlin', '2024-05-06 07:30', '2024-05-06 09:55', 1610);

INSERT INTO Passenger (id, name, birth_date) VALUES
(3401, 'Ivanov I.I.', '1990-03-12'),
(3402, 'Petrov P.P.', '1985-11-02'),
(3403, 'Sidorov S.S.', '2000-07-19'),
(3404, 'Smith John', '1978-01-30'),
(3405, 'Dubois Marie', '1995-09-05'),
(3406, 'Muller Hans', '1988-04-21');

INSERT INTO Pass_in_trip (id, trip, passenger, place, class, price) VALUES
(1, 1101, 3401, '1A', 'business', 54000),
(2, 1101, 3402, '2C', 'economy', 21000),
(3, 1102, 3401, '1A', 'business', 54000),
(4, 1103, 3403, '4B', 'economy', 9800),
(5, 1104, 3404, '3D', 'economy', 15200),
(6, 1105, 3405, '2A', 'business', 23000),
(7, 1106, 3406, '10F', 'economy', 68000),
(8, 1107, 3402, '1B', 'business', 89000),
(9, 1108, 3403, '5C', 'economy', 15200),
(10, 1108, 3401, '5D', 'economy', 15200);