import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';


const port = process.env.PORT ?? 3000
const app = express();

app.use(cors());
app.use(express.json());


// Configuración de conexión a la base de datos
const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    port: 3306,
    password: 'root',
    database: 'mecacda_db',
});

// Ver todos los socios con sus actividades
app.get('/socios', async (req, res) => {
    try {
        const [rows] = await connection.query(`
            SELECT 
                s.id_socio,
                s.nombre,
                s.dni,
                s.fecha_nacimiento,
                s.mail,
                s.telefono,
                s.fecha_registro,
                s.cantidad_reservas,
                GROUP_CONCAT(a.nombre_actividad) AS actividades
            FROM 
                socios s
            LEFT JOIN 
                socio_actividades sa ON s.id_socio = sa.id_socio
            LEFT JOIN 
                actividades a ON sa.id_actividad = a.id_actividad
            GROUP BY 
                s.id_socio;
        `);

        // Convertir las actividades de una cadena separada por comas a un array
        const sociosConActividades = rows.map(socio => ({
            ...socio,
            actividades: socio.actividades ? socio.actividades.split(',') : [],
        }));

        res.status(200).json(sociosConActividades);
    } catch (error) {
        console.error('Error al obtener los socios:', error);
        res.status(500).json({ message: 'Error al obtener los socios' });
    }
});


// Ver un socio
app.get('/socios/:dni', async (req, res) => {
    const dni = req.params.dni
    try {
        const [result] = await connection.query(
            `SELECT 
                s.nombre AS nombre_socio, 
                s.dni,
                s.fecha_nacimiento,
                s.mail,
                s.telefono,
                s.cantidad_reservas,
                s.fecha_registro, 
                s.id_socio,
                a.nombre_actividad AS actividad
            FROM 
                socios s
            LEFT JOIN 
                socio_actividades sa ON s.id_socio = sa.id_socio
            LEFT JOIN 
                actividades a ON sa.id_actividad = a.id_actividad
            WHERE 
                s.dni = ?;`
            , [dni]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: 'No se encontraron actividades para este socio' });
        }

        const socio = {
            socio: result[0].nombre_socio,
            dni: result[0].dni,
            fecha_nacimiento: result[0].fecha_nacimiento,
            mail: result[0].dni,
            telefono: result[0].telefono,
            cantidad_reservas: result[0].cantidad_reservas,
            fecha_registro: result[0].fecha_registro,
            actividades: result.map(row => row.actividad),
        }

        res.status(200).json(socio);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
})

// Ver que socios hacen cada actividad
app.get('/actividades', async (req, res) => {
    try {
        const [rows] = await connection.query(`
            SELECT 
                a.nombre_actividad AS actividad,
                s.nombre AS socio,
                s.dni,
                s.mail,
                s.fecha_nacimiento,
                s.telefono,
                s.cantidad_reservas,
                s.fecha_registro
            FROM 
                actividades a
            JOIN 
                socio_actividades sa ON a.id_actividad = sa.id_actividad
            JOIN 
                socios s ON sa.id_socio = s.id_socio
            ORDER BY 
                a.nombre_actividad, s.nombre;
        `);

        // Organizar los resultados por actividad
        const resultado = rows.reduce((acc, row) => {
            if (!acc[row.actividad]) {
                acc[row.actividad] = [];
            }
            acc[row.actividad].push({
                nombre: row.socio,
                dni: row.dni,
                mail: row.mail,
                fecha_nacimiento: row.fecha_nacimiento,
                telefono: row.telefono,
                cantidad_reservas: row.cantidad_reservas,
                fecha_registro: row.fecha_registro,
            });
            return acc;
        }, {});

        res.status(200).json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los socios por actividad' });
    }
});

// Ver que socios cumplen años este mes
app.get('/socios-por-mes/:mes', async (req, res) => {
    const mes = req.params.mes
    try {
        const [result] = await connection.query(
            `SELECT nombre, dni, fecha_nacimiento, mail FROM socios
            WHERE MONTH(fecha_nacimiento) = ?;`,
            [mes]
        );
        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
})

// Crear socio
app.post('/socios', async (req, res) => {
    const { nombre, dni, fecha_nacimiento, mail, telefono, cantidad_reservas, idActividades } = req.body;
    try {
        const [result] = await connection.query(
            'INSERT INTO socios (nombre, dni, fecha_nacimiento, mail, telefono, cantidad_reservas) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, dni, fecha_nacimiento, mail, telefono, cantidad_reservas]
        );
        // Si hay actividades, insertarlas en la tabla intermedia
        if (idActividades.length > 0 && result.insertId) {
            const values = idActividades.map(idActividad => [result.insertId, idActividad]);

            await connection.query(
                `INSERT INTO socio_actividades (id_socio, id_actividad) VALUES ?`,
                [values]
            );
        }
        res.status(201).json({ message: 'Socio creado', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
})

// Actualizar socio
app.put('/actualizar-socio/:dni', async (req, res) => {
    const dni = req.params.dni
    const { nombre, fecha_nacimiento, mail, telefono, cantidad_reservas, idActividades, id_socio } = req.body;
    try {
        const [result] = await connection.query(
            'UPDATE socios SET nombre = ?, fecha_nacimiento = ?, mail = ?, telefono = ?, cantidad_reservas = ? WHERE dni = ?',
            [nombre, fecha_nacimiento, mail, telefono, cantidad_reservas, dni]
        );
        // Eliminar actividades actuales del socio
        await connection.query(
            `DELETE FROM socio_actividades WHERE id_socio = ?`,
            [id_socio]
        );
        // Insertar las nuevas actividades si el array no está vacío
        if (idActividades.length > 0) {
            const values = idActividades.map(idActividad => [id_socio, idActividad]);

            await connection.query(
                `INSERT INTO socio_actividades (id_socio, id_actividad) VALUES ?`,
                [values]
            );
        }
        res.status(200).json({ message: 'Socio actualizado', id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error });
    }
})

// Eliminar socio
app.delete('/eliminar-socio/:dni', async (req, res) => {
    const dni = req.params.dni
    try {
        const [result] = await connection.query('DELETE FROM socios WHERE dni = ?', [dni])
        res.status(200).json({ message: 'Socio eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
})




app.listen(port, () => {
    console.log(`Server on port ${port}`)
})