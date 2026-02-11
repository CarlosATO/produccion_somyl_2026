import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, Badge, Spinner, Button, Row, Col, Form, InputGroup } from 'react-bootstrap';
import { cubicacionService } from '../../../services/cubicacionService'; // Ajusta la ruta si es necesario
import * as XLSX from 'xlsx';

const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const ReporteCubicacion = () => {
    const { projectId } = useParams();
    const [loading, setLoading] = useState(true);
    const [zonas, setZonas] = useState([]);
    const [cubicaciones, setCubicaciones] = useState([]);
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [zons, cubs] = await Promise.all([
                cubicacionService.getZonas(projectId),
                cubicacionService.getCubicaciones(projectId)
            ]);
            setZonas(zons);
            setCubicaciones(cubs);
        } catch (error) {
            console.error("Error cargando reporte cubicación", error);
        } finally {
            setLoading(false);
        }
    };

    // Procesar datos: Agrupar por Zona
    const reporteData = useMemo(() => {
        if (!zonas.length || !cubicaciones.length) return [];

        const dataPorZona = zonas.map(zona => {
            // Filtrar cubicaciones de esta zona
            const itemsZona = cubicaciones.filter(c => c.zona_id === zona.id && Number(c.cantidad) > 0);

            // Si no tiene ítems con cantidad > 0, devolvemos null para filtrarlo después (salvo que queramos mostrar zonas vacías, pero el req dice que no)
            if (itemsZona.length === 0) return null;

            // Procesar ítems para tener nombre, precio, total
            const itemsDetalle = itemsZona.map(c => {
                const isSub = !!c.sub_actividad_id;
                const nombre = isSub ? c.sub_actividad?.nombre : c.actividad?.nombre;
                const unidad = isSub ? c.sub_actividad?.unidad : c.actividad?.unidad;
                const precio = Number(isSub ? c.sub_actividad?.valor_venta : c.actividad?.valor_venta) || 0;
                const cantidad = Number(c.cantidad);
                const total = cantidad * precio;

                return {
                    id: c.id,
                    nombre,
                    unidad,
                    precio,
                    cantidad,
                    total,
                    isSub
                };
            });

            // Filtrar por texto si hay filtro
            const itemsFiltrados = filterText
                ? itemsDetalle.filter(i => i.nombre.toLowerCase().includes(filterText.toLowerCase()))
                : itemsDetalle;

            if (itemsFiltrados.length === 0) return null;

            const totalZona = itemsFiltrados.reduce((sum, item) => sum + item.total, 0);

            return {
                zona,
                items: itemsFiltrados,
                totalZona
            };
        }).filter(z => z !== null); // Eliminar zonas vacías

        return dataPorZona;
    }, [zonas, cubicaciones, filterText]);

    const totalGeneral = useMemo(() => {
        return reporteData.reduce((sum, z) => sum + z.totalZona, 0);
    }, [reporteData]);

    const handleExportExcel = () => {
        const ws_data = [];
        ws_data.push(["ZONA", "ÍTEM / ACTIVIDAD", "UNIDAD", "CANTIDAD", "PRECIO UNITARIO", "TOTAL"]);

        reporteData.forEach(g => {
            // Header Zona
            ws_data.push([g.zona.nombre.toUpperCase(), "", "", "", "", ""]);

            g.items.forEach(item => {
                ws_data.push([
                    "", // Zona vacía para items
                    item.nombre,
                    item.unidad,
                    item.cantidad,
                    item.precio,
                    item.total
                ]);
            });
            // Total Zona
            ws_data.push(["TOTAL " + g.zona.nombre, "", "", "", "", g.totalZona]);
            ws_data.push([]); // Espacio
        });

        ws_data.push(["TOTAL GENERAL", "", "", "", "", totalGeneral]);

        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Cubicación");
        XLSX.writeFile(wb, `Reporte_Cubicacion_${projectId}.xlsx`);
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <div className="container-fluid py-3 px-4 bg-slate-50 min-vh-100">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold text-slate-800 mb-0">Reporte Detallado de Cubicación</h4>
                    <p className="text-slate-500 small mb-0">Desglose de cantidades y montos por zona.</p>
                </div>
                <div className="d-flex gap-2">
                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 d-flex flex-column align-items-end">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Cubicado</span>
                        <span className="text-lg font-bold text-emerald-600">{formatMoney(totalGeneral)}</span>
                    </div>
                    <Button variant="success" size="sm" onClick={handleExportExcel} className="d-flex align-items-center h-100">
                        <i className="bi bi-file-earmark-spreadsheet me-2"></i>Exportar Excel
                    </Button>
                </div>
            </div>

            {/* Filtros */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-3">
                    <Row className="g-3 align-items-center">
                        <Col md={4}>
                            <InputGroup size="sm">
                                <InputGroup.Text className="bg-white text-muted"><i className="bi bi-search"></i></InputGroup.Text>
                                <Form.Control
                                    placeholder="Buscar actividad..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="border-start-0"
                                />
                            </InputGroup>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Tabla Detalle */}
            <div className="d-flex flex-column gap-4">
                {reporteData.length === 0 ? (
                    <div className="text-center p-5 text-muted fst-italic">No hay datos cubicados para mostrar.</div>
                ) : (
                    reporteData.map((grupo, idx) => (
                        <Card key={grupo.zona.id} className="border-0 shadow-sm overflow-hidden" style={{ borderRadius: '12px' }}>
                            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-blue-50 text-blue-600 rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                                        <i className="bi bi-geo-alt-fill small"></i>
                                    </div>
                                    <div>
                                        <h6 className="fw-bold text-slate-800 mb-0">{grupo.zona.nombre}</h6>
                                        {(grupo.zona.hp || grupo.zona.comuna) && (
                                            <small className="text-muted">
                                                {grupo.zona.hp && <span className="me-2 badge bg-light text-dark border">{grupo.zona.hp}</span>}
                                                {grupo.zona.comuna}
                                            </small>
                                        )}
                                    </div>
                                </div>
                                <div className="text-end">
                                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Total Zona</small>
                                    <span className="fw-bold text-slate-700">{formatMoney(grupo.totalZona)}</span>
                                </div>
                            </Card.Header>
                            <Table hover responsive className="mb-0 align-middle" style={{ fontSize: '0.85rem' }}>
                                <thead className="bg-light text-secondary">
                                    <tr>
                                        <th className="ps-4" style={{ width: '40%' }}>Ítem / Actividad</th>
                                        <th className="text-center" style={{ width: '10%' }}>Unidad</th>
                                        <th className="text-center" style={{ width: '15%' }}>Cantidad</th>
                                        <th className="text-end" style={{ width: '15%' }}>Precio Unitario</th>
                                        <th className="text-end pe-4" style={{ width: '20%' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grupo.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="ps-4 fw-medium text-slate-700">
                                                {item.isSub && <i className="bi bi-arrow-return-right text-muted me-2 small"></i>}
                                                {item.nombre}
                                            </td>
                                            <td className="text-center text-muted">{item.unidad}</td>
                                            <td className="text-center fw-bold">{item.cantidad}</td>
                                            <td className="text-end text-muted font-monospace">{formatMoney(item.precio)}</td>
                                            <td className="text-end pe-4 fw-bold font-monospace text-slate-800">{formatMoney(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-light">
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold text-secondary pe-3">Total {grupo.zona.nombre}:</td>
                                        <td className="text-end pe-4 fw-bold text-slate-900">{formatMoney(grupo.totalZona)}</td>
                                    </tr>
                                </tfoot>
                            </Table>
                        </Card>
                    ))
                )}
            </div>

            <div className="mt-4 p-4 bg-slate-800 text-white rounded-xl shadow-lg d-flex justify-content-between align-items-center">
                <div>
                    <h5 className="mb-0 fw-bold">Total General Proyecto</h5>
                    <small className="text-slate-400">Suma de todas las zonas cubicadas</small>
                </div>
                <h2 className="mb-0 fw-bold text-emerald-400">{formatMoney(totalGeneral)}</h2>
            </div>
            <div className="mb-5"></div>
        </div>
    );
};

export default ReporteCubicacion;
