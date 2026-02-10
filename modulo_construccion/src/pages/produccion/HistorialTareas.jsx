import React, { useState, useMemo } from 'react'
import { Table, Badge, Button, Form, InputGroup, Card } from 'react-bootstrap'
import { format, parseISO } from 'date-fns'

function HistorialTareas({ tareas, onVerDetalle, onRestaurar }) {
    const [searchTerm, setSearchTerm] = useState('')

    // 1. FILTRO MAESTRO: Solo Pagadas o Emitidas (trabajo cerrado)
    const historial = useMemo(() => {
        return tareas.filter(t =>
            ['PAGADA', 'EMITIDO'].includes(t.estado)
        ).sort((a, b) => {
            // Ordenar por fecha término descendente (lo más reciente arriba)
            const dateA = a.fecha_termino_real ? new Date(a.fecha_termino_real) : new Date(0)
            const dateB = b.fecha_termino_real ? new Date(b.fecha_termino_real) : new Date(0)
            return dateB - dateA
        })
    }, [tareas])

    // 2. FILTRO DE BÚSQUEDA (Texto)
    const filteredData = useMemo(() => {
        if (!searchTerm) return historial
        const term = searchTerm.toLowerCase()

        return historial.filter(t =>
            t.id.toString().includes(term) ||
            t.proveedor?.nombre?.toLowerCase().includes(term) ||
            t.zona?.nombre?.toLowerCase().includes(term) ||
            // Buscar en items
            (t.items && t.items.some(i =>
                i.actividad?.nombre?.toLowerCase().includes(term) ||
                i.sub_actividad?.nombre?.toLowerCase().includes(term)
            ))
        )
    }, [historial, searchTerm])

    // Helper para calcular total $ de la tarea
    const calcularTotal = (task) => {
        const items = task.items || []
        if (items.length > 0) {
            return items.reduce((sum, i) => sum + (Number(i.cantidad_real || 0) * Number(i.precio_costo_unitario || 0)), 0)
        }
        // Fallback legacy
        return (task.cantidad_real || 0) * (task.precio_costo_unitario || 0)
    }

    // Helper para resumen de actividad
    const getResumenActividad = (task) => {
        const items = task.items || []
        if (items.length === 0) {
            return task.actividad?.nombre || task.sub_actividad?.nombre || 'Sin detalle'
        }
        const primero = items[0].actividad?.nombre || items[0].sub_actividad?.nombre || 'Item'
        return items.length > 1 ? `${primero} (+${items.length - 1} más)` : primero
    }

    return (
        <div className="h-100 d-flex flex-column">
            {/* BARRA DE HERRAMIENTAS */}
            <Card className="shadow-sm border-0 mb-2">
                <Card.Body className="py-1 px-2 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                        <h6 className="mb-0 fw-bold text-secondary"><i className="bi bi-clock-history me-2"></i>Historial de Tareas</h6>
                        <Badge bg="light" text="dark" className="border">{filteredData.length} registros</Badge>
                    </div>
                    <div style={{ width: '300px' }}>
                        <InputGroup size="sm">
                            <InputGroup.Text className="bg-white border-end-0"><i className="bi bi-search text-muted"></i></InputGroup.Text>
                            <Form.Control
                                placeholder="Buscar por ID, Responsable, Zona..."
                                className="border-start-0 ps-0"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                    </div>
                </Card.Body>
            </Card>

            {/* TABLA DE DATOS */}
            <div className="flex-grow-1 bg-white border rounded-3 shadow-sm overflow-auto">
                <Table hover responsive className="mb-0 align-middle small" striped>
                    <thead className="bg-light sticky-top">
                        <tr>
                            <th className="ps-3 py-2 text-secondary">Fecha Fin</th>
                            <th className="py-2 text-secondary">ID</th>
                            <th className="py-2 text-secondary">Responsable</th>
                            <th className="py-2 text-secondary" style={{ width: '30%' }}>Actividad (Resumen)</th>
                            <th className="py-2 text-secondary">Ubicación</th>
                            <th className="text-end py-2 text-secondary">Monto Total</th>
                            <th className="text-center py-2 text-secondary">Estado</th>
                            <th className="text-end pe-3 py-2 text-secondary">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr><td colSpan="8" className="text-center py-5 text-muted">No se encontraron registros en el historial.</td></tr>
                        ) : (
                            filteredData.map(task => {
                                const total = calcularTotal(task)
                                const esSomyl = task.proveedor?.nombre?.toLowerCase().includes('somyl')

                                return (
                                    <tr key={task.id}>
                                        <td className="ps-3 py-1 text-muted font-monospace">
                                            {task.fecha_termino_real ? format(parseISO(task.fecha_termino_real), 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td className="py-1 fw-bold">#{task.id}</td>
                                        <td>
                                            <span className="fw-medium text-dark">{task.proveedor?.nombre}</span>
                                            {task.trabajador && <div className="text-muted" style={{ fontSize: '0.75em' }}>{task.trabajador.nombre_completo}</div>}
                                        </td>
                                        <td>
                                            <div className="text-truncate" style={{ maxWidth: '300px' }} title="Ver detalle">
                                                {getResumenActividad(task)}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="border fw-normal me-1">{task.zona?.nombre}</Badge>
                                            <span className="text-muted">{task.tramo?.nombre}</span>
                                        </td>
                                        <td className="text-end font-monospace fw-bold text-success">
                                            ${total.toLocaleString()}
                                        </td>
                                        <td className="text-center">
                                            {esSomyl ?
                                                <Badge bg="secondary">ARCHIVADA (Somyl)</Badge> :
                                                <Badge bg="success">PAGADA / EP</Badge>
                                            }
                                        </td>
                                        <td className="text-end pe-3">
                                            <Button variant="link" size="sm" className="p-0 me-2 text-primary" onClick={() => onVerDetalle(task)} title="Ver Detalle">
                                                <i className="bi bi-eye-fill fs-5"></i>
                                            </Button>

                                            {/* BOTÓN RESTAURAR (Solo Somyl - trabajo propio) */}
                                            {esSomyl && (
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="p-0 text-warning"
                                                    onClick={() => onRestaurar(task)}
                                                    title="Restaurar a 'En Ejecución'"
                                                >
                                                    <i className="bi bi-arrow-counterclockwise fs-5"></i>
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </Table>
            </div>
        </div>
    )
}

export default HistorialTareas