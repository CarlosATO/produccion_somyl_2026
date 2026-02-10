import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Spinner, Badge, Alert, Modal, Row, Col, Container } from 'react-bootstrap';
import { reportesService } from '../../../services/reportesService';
import { tareasService } from '../../../services/tareasService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Componente KPI (Mismo de antes)
const KpiCard = ({ title, amount, icon, color, subtitle, onClick, clickable = false }) => (
    <Card
        className={`border-0 shadow-sm h-100 position-relative overflow-hidden ${clickable ? 'cursor-pointer kpi-hover' : ''}`}
        style={{ borderRadius: '12px', transition: 'all 0.2s' }}
        onClick={onClick}
    >
        <Card.Body className="p-3">
            <div className="d-flex align-items-center mb-2">
                <div className={`rounded-circle bg-${color} bg-opacity-10 d-flex align-items-center justify-content-center me-3`} style={{ width: '40px', height: '40px' }}>
                    <i className={`bi ${icon} text-${color} fs-5`}></i>
                </div>
                <div className="text-truncate">
                    <small className="text-muted fw-bold text-uppercase d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>{title}</small>
                    <small className={`text-${color} fw-bold`} style={{ fontSize: '0.7rem' }}>{subtitle}</small>
                </div>
            </div>
            <h5 className="fw-bold text-dark mb-0 mt-1">{amount}</h5>
            {clickable && <div className="position-absolute top-0 end-0 m-2 text-muted opacity-25"><i className="bi bi-chevron-right small"></i></div>}
        </Card.Body>
    </Card>
);

const ResumenSubcontrato = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modals
    const [showModalProd, setShowModalProd] = useState(false);
    const [modalDataProd, setModalDataProd] = useState({ tipo: null, proveedor: null, tareas: [] });

    const [showModalGastos, setShowModalGastos] = useState(false);
    const [desgloseGastos, setDesgloseGastos] = useState([]);
    const [detalleGastoItem, setDetalleGastoItem] = useState(null);
    const [loadingGastos, setLoadingGastos] = useState(false);
    const [viewGastoState, setViewGastoState] = useState('resumen');

    // MODAL FICHA (MEJORADO)
    const [showModalFicha, setShowModalFicha] = useState(false);
    const [fichaItems, setFichaItems] = useState([]);
    const [loadingFicha, setLoadingFicha] = useState(false);

    const [totales, setTotales] = useState({
        costo: 0, venta: 0, emitido: 0, pendiente: 0, gastosOperativos: 0
    });

    useEffect(() => { cargarDatos(); }, [projectId]);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            setError(null);
            const [todasLasTareas, gastosOp] = await Promise.all([
                tareasService.getTareas(projectId),
                reportesService.getGastosOperativos(projectId)
            ]);

            const proveedoresMap = {};
            todasLasTareas.forEach(tarea => {
                const provId = tarea.proveedor_id;
                const provNombre = tarea.proveedor?.nombre || `Proveedor ${provId}`;
                if (!proveedoresMap[provId]) {
                    proveedoresMap[provId] = {
                        proveedor_id: provId,
                        nombre_proveedor: provNombre,
                        trabajos_count: 0,
                        tareas_produccion: [], tareas_emitidas: [], tareas_pendientes: [],
                        produccion_costo: 0, produccion_venta: 0, monto_emitido: 0, monto_pendiente: 0
                    };
                }
                const row = proveedoresMap[provId];
                if (tarea.cantidad_real > 0 || (tarea.items && tarea.items.some(i => i.cantidad_real > 0))) {
                    row.trabajos_count++;
                    const itemsProcesar = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];
                    itemsProcesar.forEach(item => {
                        const esItem = !!item.actividad || !!item.sub_actividad;
                        const cantReal = esItem ? (item.cantidad_real || 0) : (item.cantidad_real || 0);
                        if (cantReal > 0) {
                            const pCosto = item.precio_costo_unitario || 0;
                            const pVenta = item.precio_venta_unitario || 0;
                            const costo = cantReal * pCosto;
                            const venta = cantReal * pVenta;
                            const detalleObj = {
                                tarea_id: tarea.id,
                                nombre: esItem ? (item.actividad?.nombre || item.sub_actividad?.nombre) : 'Actividad',
                                cantidad: cantReal, precio_unitario: pCosto, costo: costo, venta: venta,
                                estado_ep: tarea.estado_pago?.estado || null,
                                codigo_ep: tarea.estado_pago?.codigo || null,
                                zona: tarea.zona?.nombre || '-'
                            };
                            row.tareas_produccion.push(detalleObj);
                            row.produccion_costo += costo;
                            row.produccion_venta += venta;
                            if (tarea.estado_pago && tarea.estado_pago.estado === 'EMITIDO') {
                                row.tareas_emitidas.push({ ...detalleObj }); row.monto_emitido += costo;
                            } else {
                                row.tareas_pendientes.push({ ...detalleObj }); row.monto_pendiente += costo;
                            }
                        }
                    });
                }
            });

            const dataFinal = Object.values(proveedoresMap);
            setData(dataFinal);
            const newTotales = dataFinal.reduce((acc, row) => ({
                costo: acc.costo + row.produccion_costo,
                venta: acc.venta + row.produccion_venta,
                emitido: acc.emitido + row.monto_emitido,
                pendiente: acc.pendiente + row.monto_pendiente
            }), { costo: 0, venta: 0, emitido: 0, pendiente: 0 });
            newTotales.gastosOperativos = Number(gastosOp);
            setTotales(newTotales);
        } catch (err) { console.error(err); setError("Error cargando datos."); }
        finally { setLoading(false); }
    };

    const handleClickCell = (tipo, row) => {
        let tareas = [];
        if (tipo === 'produccion') tareas = row.tareas_produccion;
        else if (tipo === 'emitido') tareas = row.tareas_emitidas;
        else if (tipo === 'pendiente') tareas = row.tareas_pendientes;
        setModalDataProd({ tipo, proveedor: row.nombre_proveedor, tareas });
        setShowModalProd(true);
    };

    const handleOpenGastos = async () => {
        setLoadingGastos(true);
        setShowModalGastos(true);
        setViewGastoState('resumen');
        try {
            const datos = await reportesService.getDesgloseGastos(projectId);
            setDesgloseGastos(datos);
        } catch (e) { console.error(e); }
        finally { setLoadingGastos(false); }
    }

    const handleOpenDetalleItem = async (categoria) => {
        setLoadingGastos(true);
        try {
            const itemsRaw = await reportesService.getDetalleGastosPorItem(projectId, categoria);
            const totalCategoria = itemsRaw.reduce((sum, item) => sum + (item.neto_total_recibido || (item.cantidad * item.neto_unitario)), 0);
            setDetalleGastoItem({ categoria, items: itemsRaw, total: totalCategoria });
            setViewGastoState('detalle');
        } catch (e) { console.error(e); }
        finally { setLoadingGastos(false); }
    }

    const handleOpenFicha = async (gasto) => {
        setLoadingFicha(true);
        setShowModalFicha(true);
        setFichaItems([]);
        try {
            const items = await reportesService.getFichaGastoCompleta(
                projectId,
                gasto.proveedor,
                gasto.factura,
                gasto.orden_compra,
                gasto.id
            );
            setFichaItems(items);
        } catch (e) {
            console.error("Error cargando ficha completa", e);
            setFichaItems([gasto]);
        } finally {
            setLoadingFicha(false);
        }
    }

    // EXPORTACIONES
    const handleExportExcel = () => {
        if (viewGastoState === 'resumen') {
            if (!desgloseGastos || desgloseGastos.length === 0) return;
            const ws = XLSX.utils.json_to_sheet(desgloseGastos.map(g => ({ Categoría: g.categoria, 'Total': g.total_categoria })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resumen");
            XLSX.writeFile(wb, `Resumen_Gastos_${projectId}.xlsx`);
        } else {
            if (!detalleGastoItem?.items) return;
            const ws = XLSX.utils.json_to_sheet(detalleGastoItem.items.map(i => ({
                Fecha: i.fecha, Proveedor: i.proveedor_nombre, Detalle: i.detalle_compra, Factura: i.factura, Monto: i.neto_total_recibido
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Detalle");
            XLSX.writeFile(wb, `Detalle_${detalleGastoItem.categoria}.xlsx`);
        }
    }

    const handleExportPDF = () => {
        const doc = new jsPDF();
        if (viewGastoState === 'resumen') {
            doc.text(`Resumen Gastos - Proyecto ${projectId}`, 14, 15);
            doc.autoTable({
                head: [["Categoría", "Monto"]],
                body: desgloseGastos.map(g => [g.categoria, formatMoney(g.total_categoria)]),
                startY: 25
            });
            doc.save(`Resumen_${projectId}.pdf`);
        } else {
            doc.text(`Detalle ${detalleGastoItem.categoria}`, 14, 15);
            doc.autoTable({
                head: [["Fecha", "Proveedor", "Detalle", "Factura", "Monto"]],
                body: detalleGastoItem.items.map(i => [
                    formatDate(i.fecha), i.proveedor_nombre, i.detalle_compra || i.material_nombre, i.factura,
                    formatMoney(i.neto_total_recibido || (i.cantidad * i.neto_unitario))
                ]),
                startY: 25
            });
            doc.save(`Detalle_${detalleGastoItem.categoria}.pdf`);
        }
    }

    const formatMoney = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-CL') : '-';
    const utilidad = totales.venta - totales.costo - totales.gastosOperativos;
    const rentabilidad = totales.venta > 0 ? (utilidad / totales.venta) * 100 : 0;

    // Header data
    const headerFicha = fichaItems.length > 0 ? fichaItems[0] : {};
    const totalFicha = fichaItems.reduce((acc, item) => acc + Number(item.neto_total_recibido || (item.cantidad * item.neto_unitario) || 0), 0);

    if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><Spinner animation="border" variant="primary" /></div>;

    return (
        <div className="container-fluid py-4 bg-light min-vh-100">
            {/* HEADER PRINCIPAL */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>

                    <h4 className="fw-bold text-dark mb-0 ls-tight">Estado de Resultados</h4>
                </div>
                <Button variant="outline-dark" size="sm" onClick={() => window.print()} className="rounded-pill px-3"><i className="bi bi-printer me-2"></i>Imprimir Reporte</Button>
            </div>
            {error && <Alert variant="danger">{error}</Alert>}

            {/* KPI STRIP */}
            <Row className="g-3 mb-4">
                <Col md={6} xl={2}><KpiCard title="Ingresos (Venta)" subtitle="Total Proyecto" amount={formatMoney(totales.venta)} icon="graph-up-arrow" color="primary" /></Col>
                <Col md={6} xl={2}><KpiCard title="Costo Mano Obra" subtitle="Subcontratos" amount={`- ${formatMoney(totales.costo)}`} icon="people-fill" color="danger" /></Col>
                <Col md={6} xl={2}><KpiCard title="Gastos Operativos" subtitle="Materiales/Insumos" amount={`- ${formatMoney(totales.gastosOperativos)}`} icon="box-seam-fill" color="warning" clickable={true} onClick={handleOpenGastos} /></Col>
                <Col md={6} xl={3}><KpiCard title="Utilidad Neta" subtitle={`${rentabilidad.toFixed(1)}% Rentabilidad`} amount={formatMoney(utilidad)} icon={utilidad >= 0 ? "emoji-smile-fill" : "emoji-frown-fill"} color={utilidad >= 0 ? "success" : "danger"} /></Col>
                <Col md={6} xl={3}>
                    <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                        <Card.Body className="p-2 d-flex flex-column justify-content-center">
                            <div className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom border-light">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Deuda Reconocida</small>
                                <span className="fw-bold text-success small">{formatMoney(totales.emitido)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center px-2 py-1">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Producción Flotante</small>
                                <span className="fw-bold text-warning small">{formatMoney(totales.pendiente)}</span>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* TABLA PRINCIPAL */}
            <Card className="border-0 shadow-sm overflow-hidden" style={{ borderRadius: '12px' }}>
                <Card.Header className="bg-white py-3 border-bottom border-light">
                    <h6 className="mb-0 fw-bold text-secondary text-uppercase small ls-1">Detalle de Producción por Subcontrato</h6>
                </Card.Header>
                <Table hover responsive className="mb-0 align-middle">
                    <thead className="bg-light text-secondary" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                        <tr>
                            <th className="py-3 ps-4 border-0">SUBCONTRATO</th>
                            <th className="py-3 text-center border-0">Q. TAREAS</th>
                            <th className="py-3 text-end border-0">VENTA</th>
                            <th className="py-3 text-end border-0">COSTO MO</th>
                            <th className="py-3 text-end border-0 text-success">MARGEN MO</th>
                            <th className="py-3 text-end border-0 text-success">EMITIDO</th>
                            <th className="py-3 text-end border-0 text-warning pe-4">PENDIENTE</th>
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '0.85rem' }}>
                        {data.map((row) => (
                            <tr key={row.proveedor_id}>
                                <td className="ps-4 fw-semibold text-dark">{row.nombre_proveedor}</td>
                                <td className="text-center"><Badge bg="secondary" className="bg-opacity-10 text-secondary fw-normal px-2">{row.trabajos_count}</Badge></td>
                                <td className="text-end fw-bold text-dark opacity-75">{formatMoney(row.produccion_venta)}</td>
                                <td className="text-end fw-bold text-primary" style={{ cursor: 'pointer' }} onClick={() => handleClickCell('produccion', row)}>{formatMoney(row.produccion_costo)}</td>
                                <td className="text-end fw-bold text-success bg-success bg-opacity-10">{formatMoney(row.produccion_venta - row.produccion_costo)}</td>
                                <td className="text-end text-success fw-medium" style={{ cursor: 'pointer' }} onClick={() => handleClickCell('emitido', row)}>{formatMoney(row.monto_emitido)}</td>
                                <td className="text-end text-warning fw-bold pe-4" style={{ cursor: 'pointer' }} onClick={() => handleClickCell('pendiente', row)}>{formatMoney(row.monto_pendiente)}</td>
                            </tr>
                        ))}
                    </tbody>
                    {data.length > 0 && (
                        <tfoot className="bg-light fw-bold" style={{ borderTop: '2px solid #e9ecef' }}>
                            <tr>
                                <td className="ps-4 text-uppercase">Totales</td>
                                <td className="text-center">-</td>
                                <td className="text-end">{formatMoney(totales.venta)}</td>
                                <td className="text-end">{formatMoney(totales.costo)}</td>
                                <td className="text-end text-success">{formatMoney(totales.venta - totales.costo)}</td>
                                <td className="text-end text-success">{formatMoney(totales.emitido)}</td>
                                <td className="text-end text-warning pe-4">{formatMoney(totales.pendiente)}</td>
                            </tr>
                        </tfoot>
                    )}
                </Table>
            </Card>

            {/* MODAL 1: DETALLE TAREAS SUBCONTRATO */}
            <Modal show={showModalProd} onHide={() => setShowModalProd(false)} size="lg" centered scrollable>
                <Modal.Header closeButton><Modal.Title>{modalDataProd.proveedor}</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Table size="sm" className="small">
                        <tbody>{modalDataProd.tareas.map((t, i) => (<tr key={i}><td>{t.nombre}</td><td className="text-end">{formatMoney(t.costo)}</td></tr>))}</tbody>
                    </Table>
                </Modal.Body>
            </Modal>

            {/* MODAL 2: GASTOS OPERATIVOS */}
            <Modal show={showModalGastos} onHide={() => setShowModalGastos(false)} size="lg" centered scrollable>
                <Modal.Header closeButton className="border-0">
                    <div className="d-flex justify-content-between w-100 align-items-center pe-3">
                        <div className="d-flex align-items-center gap-2">
                            {viewGastoState === 'detalle' && <Button variant="light" size="sm" className="rounded-circle me-2" onClick={() => setViewGastoState('resumen')}><i className="bi bi-arrow-left"></i></Button>}
                            <Modal.Title className="h5 fw-bold">{viewGastoState === 'resumen' ? 'Desglose Gastos Operativos' : `Detalle: ${detalleGastoItem?.categoria}`}</Modal.Title>
                        </div>
                        <div className="d-flex gap-2">
                            <Button variant="outline-success" size="sm" onClick={handleExportExcel}><i className="bi bi-file-earmark-excel"></i></Button>
                            <Button variant="outline-danger" size="sm" onClick={handleExportPDF}><i className="bi bi-file-earmark-pdf"></i></Button>
                        </div>
                    </div>
                </Modal.Header>
                <Modal.Body className="p-0">
                    {loadingGastos ? (
                        <div className="text-center py-5"><Spinner animation="border" size="sm" /></div>
                    ) : (
                        <>
                            {viewGastoState === 'resumen' ? (
                                <div className="list-group list-group-flush">
                                    {desgloseGastos.map((g, i) => (
                                        <div key={i} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 px-4" onClick={() => handleOpenDetalleItem(g.categoria)} style={{ cursor: 'pointer' }}>
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="rounded-circle bg-warning bg-opacity-10 p-2 text-warning"><i className="bi bi-tag-fill"></i></div>
                                                <span className="fw-medium">{g.categoria}</span>
                                            </div>
                                            <div className="d-flex align-items-center gap-3">
                                                <span className="fw-bold">{formatMoney(g.total_categoria)}</span>
                                                <i className="bi bi-chevron-right text-muted small"></i>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="d-flex flex-column h-100">
                                    <div className="bg-light p-3 border-bottom">
                                        <small className="text-muted text-uppercase d-block" style={{ fontSize: '0.7rem' }}>Total Categoría</small>
                                        <h4 className="fw-bold text-dark mb-0">{formatMoney(detalleGastoItem?.total || 0)}</h4>
                                    </div>
                                    <div className="table-responsive">
                                        <Table hover striped className="mb-0 small align-middle">
                                            <thead className="bg-white sticky-top text-secondary">
                                                <tr><th className="ps-4">Fecha</th><th>Proveedor / Detalle</th><th>Documento</th><th className="text-end pe-4">Monto</th></tr>
                                            </thead>
                                            <tbody>
                                                {detalleGastoItem?.items?.map((item, idx) => (
                                                    <tr key={idx} onClick={() => handleOpenFicha(item)} style={{ cursor: 'pointer' }}>
                                                        <td className="ps-4 text-muted">{formatDate(item.fecha)}</td>
                                                        <td>
                                                            <div className="fw-medium text-primary">{item.proveedor_nombre || 'Sin Prov.'}</div>
                                                            <div className="text-muted small text-truncate" style={{ maxWidth: '250px' }}>{item.detalle_compra || item.material_nombre || '-'}</div>
                                                        </td>
                                                        <td><Badge bg="light" text="dark" className="border">{item.factura || 'S/N'}</Badge></td>
                                                        <td className="text-end fw-bold pe-4">{formatMoney(item.neto_total_recibido || (item.cantidad * item.neto_unitario))}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                    <div className="p-2 text-center bg-light border-top"><small className="text-muted fst-italic">Haga clic en una fila para ver el documento completo.</small></div>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/* --- MODAL 3: FICHA DE GASTO COMPLETA (DISEÑO EJECUTIVO) --- */}
            <Modal show={showModalFicha} onHide={() => setShowModalFicha(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-light border-bottom py-2">
                    <div className="small fw-bold text-uppercase text-muted ls-1">Ficha de Control Financiero</div>
                </Modal.Header>
                <Modal.Body className="p-0">
                    {loadingFicha ? <div className="text-center py-5"><Spinner animation="border" /></div> : (
                        fichaItems.length > 0 ? (
                            <div className="bg-light">

                                {/* PANEL CABECERA */}
                                <div className="bg-white p-4 border-bottom shadow-sm">
                                    <div className="d-flex justify-content-between align-items-start mb-4">
                                        <div>
                                            <h3 className="fw-bold text-dark mb-0">ORDEN DE PAGO</h3>
                                            <div className="text-muted mt-1 small">ID Interno Sistema: #{headerFicha.id}</div>
                                        </div>
                                        <div className="text-end">
                                            <Badge bg={headerFicha.estado_pago === 'PAGADO' ? 'success' : 'warning'} className="fs-6 px-4 py-2 rounded-pill">
                                                {headerFicha.estado_pago || 'PENDIENTE'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <Row className="g-4">
                                        {/* DATOS PROVEEDOR */}
                                        <Col md={5}>
                                            <div className="p-0">
                                                <h6 className="text-uppercase text-muted x-small fw-bold mb-2">Proveedor / Beneficiario</h6>
                                                <div className="fs-5 fw-bold text-primary">{headerFicha.proveedor_nombre || 'Proveedor Desconocido'}</div>
                                                <div className="text-muted small mt-1">ID Ref: {headerFicha.proveedor || '-'}</div>
                                            </div>
                                        </Col>

                                        {/* DATOS REFERENCIA DOCUMENTOS */}
                                        <Col md={7}>
                                            <div className="p-3 bg-light rounded-3 border">
                                                <Row className="g-2 align-items-center">
                                                    <Col xs={7} className="text-muted small text-uppercase fw-bold">N° Orden Pago:</Col>
                                                    <Col xs={5} className="fw-bold text-end text-dark">#{headerFicha.orden_numero}</Col>

                                                    <Col xs={7} className="text-muted small text-uppercase fw-bold">N° Orden Compra:</Col>
                                                    <Col xs={5} className="fw-bold text-end text-dark">{headerFicha.orden_compra || '-'}</Col>

                                                    <div className="w-100 border-top my-1"></div>

                                                    <Col xs={7} className="text-muted small text-uppercase fw-bold">Documento / Factura:</Col>
                                                    <Col xs={5} className="fw-bold text-end text-dark fs-6">{headerFicha.factura || 'S/N'}</Col>
                                                </Row>
                                            </div>
                                        </Col>
                                    </Row>

                                    {/* BARRA DE FECHAS */}
                                    <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                                        <div>
                                            <small className="text-muted d-block text-uppercase x-small fw-bold">Fecha Emisión</small>
                                            <strong className="text-dark">{formatDate(headerFicha.fecha)}</strong>
                                        </div>
                                        <div>
                                            <small className="text-muted d-block text-uppercase x-small fw-bold">Vencimiento</small>
                                            <strong className="text-danger">{formatDate(headerFicha.vencimiento)}</strong>
                                        </div>
                                        <div>
                                            <small className="text-muted d-block text-uppercase x-small fw-bold">Condición Pago</small>
                                            <strong className="text-dark">{headerFicha.condicion_pago || 'Contado'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* GLOSA / DESCRIPCIÓN GENERAL (FUERA DE TABLA) */}
                                {headerFicha.detalle_compra && (
                                    <div className="px-4 py-3 bg-white border-bottom mt-2">
                                        <small className="text-uppercase text-muted fw-bold mb-1 d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Glosa / Descripción General</small>
                                        <p className="mb-0 text-dark fst-italic" style={{ fontSize: '0.95rem' }}>{headerFicha.detalle_compra}</p>
                                    </div>
                                )}

                                {/* TABLA DE ÍTEMS LIMPIA */}
                                <div className="p-4">
                                    <Card className="border-0 shadow-sm overflow-hidden">
                                        <Table hover responsive className="mb-0 align-middle">
                                            <thead className="bg-secondary bg-opacity-10 text-secondary small text-uppercase">
                                                <tr>
                                                    <th className="ps-4 border-0 py-2">Ítem / Material</th>
                                                    <th className="text-center border-0 py-2">Cant.</th>
                                                    <th className="text-end border-0 py-2">Precio Unit.</th>
                                                    <th className="text-end pe-4 border-0 py-2">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {fichaItems.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="ps-4 fw-medium text-dark py-3">
                                                            {item.material_nombre || item.item || 'Ítem Estándar'}
                                                        </td>
                                                        <td className="text-center py-3">{item.cantidad || 1}</td>
                                                        <td className="text-end text-muted py-3">{formatMoney(item.neto_unitario)}</td>
                                                        <td className="text-end pe-4 fw-bold py-3 text-dark">{formatMoney(item.neto_total_recibido)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-light">
                                                <tr>
                                                    <td colSpan="3" className="text-end fw-bold py-3 text-uppercase text-muted small">Total Neto Documento:</td>
                                                    <td className="text-end pe-4 fw-bold py-3 fs-5 text-primary">{formatMoney(totalFicha)}</td>
                                                </tr>
                                            </tfoot>
                                        </Table>
                                    </Card>
                                </div>

                                {/* FOOTER INFORMACIÓN ADICIONAL */}
                                <div className="px-4 pb-4">
                                    <div className="d-flex justify-content-between align-items-center text-muted small">
                                        <div>
                                            <i className="bi bi-person-check me-1"></i> Autorizado por: <strong>{headerFicha.autoriza_nombre || headerFicha.autoriza || '-'}</strong>
                                        </div>
                                        {headerFicha.pdf_filename && (
                                            <Button variant="outline-primary" size="sm" href={headerFicha.pdf_filename} target="_blank" className="rounded-pill px-3">
                                                <i className="bi bi-file-earmark-pdf me-2"></i>Ver PDF Original
                                            </Button>
                                        )}
                                    </div>
                                </div>

                            </div>
                        ) : <div className="text-center text-muted py-5">No se encontró información del documento.</div>
                    )}
                </Modal.Body>
                <Modal.Footer className="bg-white border-top">
                    <Button variant="secondary" onClick={() => setShowModalFicha(false)}>Cerrar Ficha</Button>
                </Modal.Footer>
            </Modal>

        </div>
    );
};

export default ResumenSubcontrato;