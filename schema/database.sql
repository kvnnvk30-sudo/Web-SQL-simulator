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