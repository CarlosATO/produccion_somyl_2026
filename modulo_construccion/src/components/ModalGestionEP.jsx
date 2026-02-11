import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Table, Form, Badge, Spinner, Row, Col, Alert } from 'react-bootstrap';
import { format } from 'date-fns';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DocumentoEP from './pdf/DocumentoEP';
import { tareasService } from '../services/tareasService'; // Ajusta tu ruta
import { descuentosService } from '../services/descuentosService'; // Ajusta tu ruta

const ModalGestionEP = ({ show, onHide, ep, onEmitir, proyectoInfo }) => {
    const [loading, setLoading] = useState(true);
    // Detectamos si el EP ya fue procesado para bloquear la edición
    const isReadOnly = ['EMITIDO', 'PAGADO'].includes(ep?.estado);

    // Datos traídos del servidor
    const [tareas, setTareas] = useState([]);
    const [descuentosPendientes, setDescuentosPendientes] = useState([]);

    // Selecciones del usuario (Checkbox)
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [selectedDescuentos, setSelectedDescuentos] = useState([]);

    useEffect(() => {
        if (show && ep) {
            loadData();
        }
    }, [show, ep]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Cargar Tareas asociadas a este EP
            const t = await tareasService.getTareasPorEP(ep.id);

            // 2. Cargar Descuentos
            let d = [];
            if (['EMITIDO', 'PAGADO'].includes(ep.estado)) {
                // Si está emitido/pagado, traemos SOLO los que se usaron en este EP
                d = await descuentosService.getPorEP(ep.id);
            } else {
                // Si es borrador, traemos los PENDIENTES disponibles del proveedor
                d = await descuentosService.getPendientes(ep.proyecto_id, ep.proveedor_id);
            }

            setTareas(t);
            setDescuentosPendientes(d);

            // Por defecto, seleccionamos TODO (para facilitar la vida)
            setSelectedTasks(t.map(x => x.id));

            // Si es borrador, seleccionamos todos por defecto (opcional)
            // Si es emitido, DEBEN venir seleccionados visualmente para el PDF/Resumen
            setSelectedDescuentos(d.map(x => x.id));

        } catch (err) {
            console.error("Error cargando detalles EP", err);
        } finally {
            setLoading(false);
        }
    };

    // Tareas seleccionadas (para el PDF y la vista previa)
    const tareasSeleccionadas = tareas.filter(t => selectedTasks.includes(t.id));
    // Descuentos seleccionados para pasar al PDF
    const descuentosParaPDF = descuentosPendientes
        .filter(d => selectedDescuentos.includes(d.id))
        .map(d => ({ nombre: d.tipo || d.descripcion || d.nombre || 'Descuento', monto: Number(d.monto || 0), descripcion: d.descripcion || '' }));

    // --- MANEJO DE CHECKBOX ---
    const toggleTask = (id) => {
        if (selectedTasks.includes(id)) setSelectedTasks(selectedTasks.filter(x => x !== id));
        else setSelectedTasks([...selectedTasks, id]);
    };

    const toggleDescuento = (id) => {
        if (selectedDescuentos.includes(id)) setSelectedDescuentos(selectedDescuentos.filter(x => x !== id));
        else setSelectedDescuentos([...selectedDescuentos, id]);
    };

    // --- CÁLCULOS MATEMÁTICOS EN VIVO ---
    const resumen = useMemo(() => {
        // 1. Sumar tareas seleccionadas
        const tareasElegidas = tareas.filter(t => selectedTasks.includes(t.id));
        const totalNeto = tareasElegidas.reduce((acc, t) => {
            // Calcular cantidad y precio desde items si existen, sino desde cabecera
            if (t.items && t.items.length > 0) {
                // Sumar todos los items de la tarea
                const subtotal = t.items.reduce((sum, item) => {
                    const cant = item.cantidad_real || item.cantidad_asignada || 0;
                    const precio = item.precio_costo_unitario || 0;
                    return sum + (cant * precio);
                }, 0);
                return acc + subtotal;
            } else {
                // Fallback: usar datos de cabecera
                const cantidad = t.cantidad_real || t.cantidad_asignada || 0;
                const precio = t.precio_costo_unitario || 0;
                return acc + (cantidad * precio);
            }
        }, 0);

        // 2. Sumar descuentos seleccionados
        const descuentosElegidos = descuentosPendientes.filter(d => selectedDescuentos.includes(d.id));
        const totalDescuentos = descuentosElegidos.reduce((acc, d) => acc + Number(d.monto), 0);

        // 3. Total Final
        const totalPagar = totalNeto - totalDescuentos;

        return { totalNeto, totalDescuentos, totalPagar, countTareas: tareasElegidas.length };
    }, [tareas, descuentosPendientes, selectedTasks, selectedDescuentos]);


    // --- ACCIÓN FINAL ---
    const handleEmitirClick = () => {
        if (selectedTasks.length === 0) return alert("Debes seleccionar al menos una tarea.");
        // Abrimos modal de confirmación (estética consistente con la app)
        setShowConfirm(true)
    };

    // Confirmación mediante modal de Bootstrap
    const [showConfirm, setShowConfirm] = useState(false);

    const confirmEmitir = () => {
        setShowConfirm(false);
        const payload = {
            epId: ep.id,
            taskIds: selectedTasks,       // Las que se van a pagar
            discountIds: selectedDescuentos, // Los descuentos a aplicar
            tasksTotal: tareas.length,    // Para saber si sobraron (Split)
            montoFinal: resumen.totalPagar
        };
        onEmitir(payload);
    };

    if (!ep) return null;

    return (
        <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="bg-light">
                <div>
                    <Modal.Title className="fw-bold text-primary">
                        <i className="bi bi-file-earmark-spreadsheet me-2"></i>
                        Emisión de Estado de Pago
                    </Modal.Title>
                    <div className="text-muted small mt-1">
                        Borrador: <strong>{ep.codigo}</strong> | Proveedor: <strong>{ep.proveedor?.nombre}</strong>
                    </div>
                </div>
            </Modal.Header>

            <Modal.Body className="p-0">
                {loading ? <div className="p-5 text-center"><Spinner animation="border" /></div> : (
                    <div className="d-flex flex-column flex-lg-row h-100">

                        {/* COLUMNA IZQUIERDA: DETALLE DE TAREAS (INGRESOS) */}
                        <div className="flex-grow-1 p-3 border-end" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <h6 className="fw-bold text-secondary mb-3">1. Seleccionar Trabajos a Pagar</h6>
                            <Table hover size="sm" className="small align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th style={{ width: '30px' }}><input type="checkbox" checked={selectedTasks.length === tareas.length && tareas.length > 0} onChange={(e) => setSelectedTasks(e.target.checked ? tareas.map(t => t.id) : [])} /></th>
                                        <th>Actividad</th>
                                        <th>Ubicación</th>
                                        <th className="text-end">Cant. Real</th>
                                        <th className="text-end">P.Unit</th>
                                        <th className="text-end">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tareas.flatMap(t => {
                                        // Si tiene items, expandir cada uno como fila; si no, mostrar la tarea como fila
                                        if (t.items && t.items.length > 0) {
                                            return t.items.map((item, idx) => {
                                                const cantidadReal = item.cantidad_real || item.cantidad_asignada || 0;
                                                const precio = item.precio_costo_unitario || 0;
                                                const totalRow = cantidadReal * precio;
                                                const nombreActividad = item.actividad?.nombre || item.sub_actividad?.nombre || 'Actividad';
                                                const isChecked = selectedTasks.includes(t.id);

                                                return (
                                                    <tr key={`${t.id}-item-${idx}`} className={isChecked ? 'table-active' : ''}>
                                                        {idx === 0 && (
                                                            <td rowSpan={t.items.length}>
                                                                <input type="checkbox" checked={isChecked} onChange={() => toggleTask(t.id)} />
                                                            </td>
                                                        )}
                                                        <td>
                                                            <div className="fw-bold">{nombreActividad}</div>
                                                            <div className="text-muted" style={{ fontSize: '0.75em' }}>{format(new Date(t.fecha_asignacion), 'dd/MM')}</div>
                                                        </td>
                                                        <td><Badge bg="light" text="dark" className="border">{t.zona?.nombre}</Badge></td>
                                                        <td className="text-end">{cantidadReal}</td>
                                                        <td className="text-end text-muted">${Number(precio).toLocaleString()}</td>
                                                        <td className="text-end fw-bold">${totalRow.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            });
                                        } else {
                                            // Fallback: tarea sin items (legacy)
                                            const cantidadReal = t.cantidad_real || t.cantidad_asignada || 0;
                                            const nombreActividad = t.actividad?.nombre || t.sub_actividad?.nombre || 'Actividad';
                                            const totalRow = cantidadReal * (t.precio_costo_unitario || 0);
                                            const isChecked = selectedTasks.includes(t.id);

                                            return (
                                                <tr key={t.id} className={isChecked ? 'table-active' : ''}>
                                                    <td><input type="checkbox" checked={isChecked} onChange={() => toggleTask(t.id)} /></td>
                                                    <td>
                                                        <div className="fw-bold">{nombreActividad}</div>
                                                        <div className="text-muted" style={{ fontSize: '0.75em' }}>{format(new Date(t.fecha_asignacion), 'dd/MM')}</div>
                                                    </td>
                                                    <td><Badge bg="light" text="dark" className="border">{t.zona?.nombre}</Badge></td>
                                                    <td className="text-end">{cantidadReal}</td>
                                                    <td className="text-end text-muted">${Number(t.precio_costo_unitario || 0).toLocaleString()}</td>
                                                    <td className="text-end fw-bold">${totalRow.toLocaleString()}</td>
                                                </tr>
                                            );
                                        }
                                    })}
                                </tbody>
                            </Table>
                            {tareas.length === 0 && <div className="text-center text-muted p-3">No hay tareas en este borrador.</div>}
                        </div>

                        {/* COLUMNA DERECHA: DESCUENTOS Y RESUMEN */}
                        <div className="p-3 bg-light" style={{ width: '35%', minWidth: '350px' }}>

                            {/* TABLA DE DESCUENTOS */}
                            <div className="mb-4">
                                <h6 className="fw-bold text-danger mb-3">2. Aplicar Descuentos / Cargos</h6>
                                {descuentosPendientes.length > 0 ? (
                                    <div className="bg-white rounded border shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        <Table size="sm" className="mb-0 small" borderless>
                                            <tbody>
                                                {descuentosPendientes.map(d => {
                                                    const isChecked = selectedDescuentos.includes(d.id);
                                                    return (
                                                        <tr key={d.id} className={isChecked ? 'bg-danger bg-opacity-10' : ''}>
                                                            <td style={{ width: '30px' }} className="ps-3"><input type="checkbox" checked={isChecked} onChange={() => toggleDescuento(d.id)} /></td>
                                                            <td>
                                                                <div className="fw-bold text-dark">{d.tipo}</div>
                                                                <div className="text-muted text-truncate" style={{ maxWidth: '150px' }} title={d.descripcion}>{d.descripcion}</div>
                                                            </td>
                                                            <td className="text-end pe-3 fw-bold text-danger">-${Number(d.monto).toLocaleString()}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="alert alert-light border text-center text-muted small">
                                        <i className="bi bi-check-circle me-1"></i> Sin descuentos pendientes.
                                    </div>
                                )}
                            </div>

                            {/* TARJETA DE RESUMEN FINAL */}
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <h6 className="card-title fw-bold border-bottom pb-2 mb-3">Resumen de Emisión</h6>

                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted">Trabajos ({resumen.countTareas}):</span>
                                        <span className="fw-bold">${resumen.totalNeto.toLocaleString()}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-3 text-danger">
                                        <span>Descuentos:</span>
                                        <span>- ${resumen.totalDescuentos.toLocaleString()}</span>
                                    </div>

                                    <div className="p-2 bg-primary bg-opacity-10 rounded border border-primary d-flex justify-content-between align-items-center mb-3">
                                        <span className="fw-bold text-primary">TOTAL A PAGAR</span>
                                        <span className="fs-4 fw-bold text-dark">${resumen.totalPagar.toLocaleString()}</span>
                                    </div>

                                    {/* ALERTA DE SPLIT */}
                                    {selectedTasks.length < tareas.length && selectedTasks.length > 0 && (
                                        <Alert variant="warning" className="small py-2 mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                            <strong>División de EP:</strong> Se emitirá por {selectedTasks.length} tareas. Las {tareas.length - selectedTasks.length} restantes se moverán a un nuevo borrador.
                                        </Alert>
                                    )}

                                    <div className="mt-4">
                                        {/* CASO 1: YA ESTÁ EMITIDO (Solo mostramos Descargar) */}
                                        {isReadOnly ? (
                                            <div className="d-grid">
                                                <PDFDownloadLink
                                                    document={<DocumentoEP epData={ep} tareas={tareasSeleccionadas} proyectoInfo={proyectoInfo} descuentos={descuentosParaPDF} />}
                                                    fileName={`EP-${ep.codigo}.pdf`}
                                                    className="text-decoration-none"
                                                >
                                                    {({ loading }) => (
                                                        <Button variant="primary" size="lg" className="w-100 shadow-sm" disabled={loading}>
                                                            <i className="bi bi-file-earmark-pdf-fill me-2"></i>
                                                            {loading ? 'Generando...' : 'Descargar Copia Oficial'}
                                                        </Button>
                                                    )}
                                                </PDFDownloadLink>
                                                <div className="text-center mt-2">
                                                    <small className="text-success fw-bold">
                                                        <i className="bi bi-check-circle-fill me-1"></i> Este documento ya fue emitido
                                                    </small>
                                                </div>
                                            </div>
                                        ) : (
                                            /* CASO 2: ES BORRADOR (Botones Asimétricos) */
                                            <div className="d-flex align-items-stretch gap-2">
                                                {/* Botón A: Vista Previa (Pequeño / Secundario) */}
                                                <PDFDownloadLink
                                                    document={<DocumentoEP epData={ep} tareas={tareasSeleccionadas} proyectoInfo={proyectoInfo} descuentos={descuentosParaPDF} />}
                                                    fileName={`Borrador-${ep.codigo}.pdf`}
                                                    className="text-decoration-none"
                                                >
                                                    {({ loading }) => (
                                                        <Button
                                                            variant="outline-secondary"
                                                            className="h-100 px-3 border-2"
                                                            title="Ver vista previa del PDF"
                                                            disabled={loading}
                                                        >
                                                            {loading ? <Spinner size="sm" /> : <i className="bi bi-eye fs-5"></i>}
                                                        </Button>
                                                    )}
                                                </PDFDownloadLink>

                                                {/* Botón B: Confirmar (Grande / Principal) */}
                                                <Button
                                                    variant="success"
                                                    className="flex-grow-1 py-2 fw-bold shadow-sm text-uppercase"
                                                    onClick={handleEmitirClick}
                                                >
                                                    Confirmar Emisión
                                                    <span className="d-block small fw-normal text-white-50" style={{ fontSize: '0.7rem' }}>
                                                        Irreversible
                                                    </span>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Botón Cancelar (siempre abajo, limpio) */}
                                    {!isReadOnly && (
                                        <div className="text-center mt-3">
                                            <button className="btn btn-link text-muted text-decoration-none btn-sm" onClick={onHide}>
                                                Cancelar operación
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </Modal.Body>

            {/* Modal de confirmación estética */}
            <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirmar Emisión</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="mb-0">Esta acción es irreversible. ¿Deseas confirmar la emisión del Estado de Pago <strong>{ep?.codigo}</strong> por <strong>{selectedTasks.length}</strong> tarea(s)?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={confirmEmitir}>Confirmar y Emitir</Button>
                </Modal.Footer>
            </Modal>
        </Modal>
    );
};

export default ModalGestionEP;