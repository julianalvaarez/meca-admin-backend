import mysql from 'mysql2/promise';

// Configuración de conexión a la base de datos
export const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    port: 3306,
    password: 'root',
    database: 'mecacda_db',
});
