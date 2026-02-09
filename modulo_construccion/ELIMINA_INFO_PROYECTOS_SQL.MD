-- ⚠️ REEMPLAZA EL 12 CON EL ID REAL DE TU PROYECTO
DO $$ 
DECLARE 
    target_project_id INT := 12; 
BEGIN
    RAISE NOTICE 'Iniciando limpieza PROFUNDA para proyecto %...', target_project_id;

    -- 1. Intentar eliminar Consumos/Stock (Si la tabla existe)
    BEGIN
        -- Intentamos borrar asumiendo nombres comunes. Si falla, no detiene el script.
        EXECUTE 'DELETE FROM prod_consumos_stock WHERE tarea_id IN (SELECT id FROM prod_tareas WHERE proyecto_id = $1)' USING target_project_id;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Tabla de consumos no encontrada. Saltando paso...';
    END;

    -- 2. Eliminar Cubicaciones (Matriz)
    BEGIN
        DELETE FROM prod_cubicaciones WHERE proyecto_id = target_project_id;
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Tabla cubicaciones no encontrada...';
    END;

    -- 3. Eliminar Tareas (Kanban y Cronograma)
    -- Esto elimina la ejecución real y planificada.
    DELETE FROM prod_tareas WHERE proyecto_id = target_project_id;

    -- 4. Eliminar Tramos (Hijos de Zonas)
    DELETE FROM prod_tramos WHERE proyecto_id = target_project_id;

    -- 5. Eliminar Zonas (Padres)
    DELETE FROM prod_zonas WHERE proyecto_id = target_project_id;

    -- 6. Eliminar Estados de Pago (Financiero)
    DELETE FROM prod_estados_pago WHERE proyecto_id = target_project_id;

    -- 7. (Opcional) Eliminar Descuentos
    BEGIN
        DELETE FROM prod_descuentos WHERE proyecto_id = target_project_id;
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Tabla descuentos no encontrada...';
    END;

    RAISE NOTICE 'Limpieza completada exitosamente para el proyecto %.', target_project_id;
END $$;