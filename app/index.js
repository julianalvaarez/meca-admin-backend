import express from 'express';
import cors from 'cors';
import { supabase as connection } from './libs/supabase.js';

const port = process.env.PORT ?? 3000
const app = express();

app.use(cors());
app.use(express.json());

// Ver todos los socios con sus actividades
app.get('/socios', async (req, res) => {
    try {
        // const [rows] = await connection.query(`
        //     SELECT 
        //         s.id_socio,
        //         s.nombre,
        //         s.dni,
        //         s.fecha_nacimiento,
        //         s.mail,
        //         s.telefono,
        //         s.fecha_registro,
        //         s.cantidad_reservas,
        //         GROUP_CONCAT(a.nombre_actividad) AS actividades
        //     FROM 
        //         socios s
        //     LEFT JOIN 
        //         socio_actividades sa ON s.id_socio = sa.id_socio
        //     LEFT JOIN 
        //         actividades a ON sa.id_actividad = a.id_actividad
        //     GROUP BY 
        //         s.id_socio;
        // `);

        // // Convertir las actividades de una cadena separada por comas a un array
        // const sociosConActividades = rows.map(socio => ({
        //     ...socio,
        //     actividades: socio.actividades ? socio.actividades.split(',') : [],
        // }));

        // res.status(200).json(sociosConActividades);
        const { data: socios, error } = await connection
            .from('socios')
            .select(`
            id_socio,
            nombre,
            dni,
            fecha_nacimiento,
            mail,
            telefono,
            fecha_registro,
            categoria_padel,
            notas,
            socio_actividades (
                actividades (
                    nombre_actividad
                )
            )
        `);

        if (error) throw error;

        const sociosConActividades = socios.map(socio => ({
            ...socio,
            actividades: socio.socio_actividades.map(sa => sa.actividades.nombre_actividad),
        }));

        // Eliminar la propiedad `socio_actividades` que no es necesaria
        sociosConActividades.forEach(socio => {
            delete socio.socio_actividades;
        });

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
        // const [result] = await connection.query(
        //     `SELECT 
        //         s.nombre AS nombre_socio, 
        //         s.dni,
        //         s.fecha_nacimiento,
        //         s.mail,
        //         s.telefono,
        //         s.cantidad_reservas,
        //         s.fecha_registro, 
        //         s.id_socio,
        //         a.nombre_actividad AS actividad
        //     FROM 
        //         socios s
        //     LEFT JOIN 
        //         socio_actividades sa ON s.id_socio = sa.id_socio
        //     LEFT JOIN 
        //         actividades a ON sa.id_actividad = a.id_actividad
        //     WHERE 
        //         s.dni = ?;`
        //     , [dni]
        // );

        const { data, error } = await connection.from('socios')
            .select(`
            id_socio,
            nombre,
            dni,
            fecha_nacimiento,
            mail,
            telefono,
            fecha_registro,
            categoria_padel,
            notas,
            socio_actividades (
                actividades (
                    nombre_actividad
                )
            )      
        `)
            .eq('dni', dni)

        if (data[0].length === 0) {
            return res.status(404).json({ message: 'No se encontraron actividades para este socio' });
        }

        const socio = {
            id_socio: data[0].id_socio,
            socio: data[0].nombre,
            dni: data[0].dni,
            fecha_nacimiento: data[0].fecha_nacimiento,
            mail: data[0].dni,
            telefono: data[0].telefono,
            cantidad_reservas: data[0].cantidad_reservas,
            fecha_registro: data[0].fecha_registro,
            actividades: data[0].socio_actividades.map(sa => sa.actividades.nombre_actividad)
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
        // Realizar la consulta con Supabase
        const { data, error } = await connection
            .from('actividades')
            .select(`
                nombre_actividad,
                socio_actividades (
                    socios (
                        nombre,
                        dni,
                        mail,
                        fecha_nacimiento,
                        telefono,
                        categoria_padel,
                        fecha_registro
                    )
                )
            `);

        // Manejar errores
        if (error) throw error;

        // Organizar los resultados por actividad
        const resultado = data.reduce((acc, actividad) => {
            acc[actividad.nombre_actividad] = actividad.socio_actividades.map(sa => sa.socios);
            return acc;
        }, {});

        res.status(200).json(resultado);
    } catch (error) {
        console.error('Error al obtener los socios por actividad:', error);
        res.status(500).json({ message: 'Error al obtener los socios por actividad' });
    }
});

// Ver que socios cumplen años este mes
app.get('/socios-por-mes/:mes', async (req, res) => {
    const mes = parseInt(req.params.mes); // Convertir el mes a número
    try {
        const { data, error } = await connection
            .from('socios_con_mes')
            .select('*')
            .eq('mes_cumple', mes);

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener socios por mes:', error);
        res.status(500).json({ message: 'Error al obtener socios por mes' });
    }
});


// Crear socio
app.post('/socios', async (req, res) => {
    const { nombre, dni, fecha_nacimiento, mail, telefono, categoria_padel, notas, idActividades } = req.body;
    try {
        const { data: socio, error } = await connection
            .from('socios')
            .insert([
                { nombre, dni, fecha_nacimiento, mail, telefono, categoria_padel, notas },
            ])
            .select();

        if (error) throw error;

        if (idActividades.length > 0) {
            const actividades = idActividades.map(idActividad => ({
                id_socio: socio[0].id_socio,
                id_actividad: idActividad,
            }));

            const { error: actividadError } = await connection
                .from('socio_actividades')
                .insert(actividades);

            if (actividadError) throw actividadError;
        }

        res.status(201).json({ message: 'Socio creado', socio: socio[0] });
    } catch (error) {
        console.error('Error al crear el socio:', error);
        res.status(500).json({ message: 'Error al crear el socio' });
    }
});


// Actualizar socio
app.put('/actualizar-socio/:dni', async (req, res) => {
    const dni = req.params.dni;
    const { nombre, fecha_nacimiento, mail, telefono, categoria_padel, notas, idActividades, id_socio } = req.body;
    try {
        // Actualizar los datos del socio
        const { error: updateError } = await connection
            .from('socios')
            .update({
                nombre,
                fecha_nacimiento,
                mail,
                telefono,
                categoria_padel,
                notas,
            })
            .eq('dni', dni);

        if (updateError) throw updateError;

        // Eliminar actividades actuales del socio
        const { error: deleteError } = await connection
            .from('socio_actividades')
            .delete()
            .eq('id_socio', id_socio);

        if (deleteError) throw deleteError;

        // Insertar las nuevas actividades
        if (idActividades && idActividades.length > 0) {
            const actividades = idActividades.map(idActividad => ({ id_socio, id_actividad: idActividad }));

            const { error: insertError } = await connection
                .from('socio_actividades')
                .insert(actividades);

            if (insertError) throw insertError;
        }

        res.status(200).json({ message: 'Socio actualizado' });
    } catch (error) {
        console.error('Error al actualizar el socio:', error);
        res.status(500).json({ message: 'Error al actualizar el socio' });
    }
});

// Eliminar socio
app.delete('/eliminar-socio/:dni', async (req, res) => {
    const dni = req.params.dni
    try {
        const { data, error } = await connection.from('socios').delete().eq('dni', dni);
        if (error) throw error;
        res.status(200).json({ message: 'Socio eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
})

// Endpoint para obtener notas
app.get("/notas", async (req, res) => {
    try {
        const { data, error } = await connection
            .from("notas")
            .select("*");

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ message: "Error al obtener notas", error: err.message });
    }
});

// Endpoint para guardar o actualizar notas
app.post("/notas", async (req, res) => {
    const { actividad, nota } = req.body;

    try {
        const { data, error } = await connection
            .from("notas")
            .upsert({ actividad, nota }, { onConflict: ["actividad"] });

        if (error) throw error;
        res.status(200).json({ message: "Nota guardada exitosamente", data });
    } catch (err) {
        res.status(500).json({ message: "Error al guardar nota", error: err.message });
    }
});


app.listen(port, () => {
    console.log(`Server on port ${port}`)
})