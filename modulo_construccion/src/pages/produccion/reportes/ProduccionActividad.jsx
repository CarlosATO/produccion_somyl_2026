import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Spinner, ProgressBar, Alert, Modal, Row, Col, Badge } from 'react-bootstrap';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { tareasService } from '../../../services/tareasService';
import { cubicacionService } from '../../../services/cubicacionService';

const ProduccionActividad = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [tareas, setTareas] = useState([]);
  const [cubicaciones, setCubicaciones] = useState([]);
  const [actividadesAgrupadas, setActividadesAgrupadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [tareasDeActividad, setTareasDeActividad] = useState([]);

  // Totales
  const [totales, setTotales] = useState({ cubicado: 0, ejecutado: 0, costo_ejecutado: 0 });

  useEffect(() => {
    cargarDatos();
  }, [projectId]);

  useEffect(() => {
    if (tareas && cubicaciones) {
      procesarActividadesComparadas();
    }
  }, [tareas, cubicaciones]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar tareas y cubicaciones en paralelo
      const [tareasData, cubicacionesData] = await Promise.all([
        tareasService.getTareas(projectId),
        cubicacionService.getCubicaciones(projectId)
      ]);

      setTareas(tareasData || []);
      setCubicaciones(cubicacionesData || []);

    } catch (err) {
      console.error(err);
      setError("Error al cargar datos de producción.");
    } finally {
      setLoading(false);
    }
  };

  // Procesar datos: CONTRASTE CUBICACIÓN vs EJECUCIÓN
  const procesarActividadesComparadas = () => {
    const actividadesMap = {};

    // 1. CARGAR CUBICACIONES
    cubicaciones.forEach(cub => {
      // FIX: Usar sub_actividad_id si existe, para que coincida con la lógica de ejecución
      const actId = cub.sub_actividad_id || cub.actividad_id;

      if (!actividadesMap[actId]) {
        actividadesMap[actId] = {
          actividad_id: actId,
          nombre_actividad: cub.actividad?.nombre || cub.sub_actividad?.nombre || 'Actividad',
          unidad: cub.actividad?.unidad || cub.sub_actividad?.unidad || 'UN',
          cantidad_cubicada: 0,
          cantidad_ejecutada: 0,
          costo_ejecutado: 0,
          tareas_realizadas: []
        };
      }
      actividadesMap[actId].cantidad_cubicada += Number(cub.cantidad) || 0;
    });

    // 2. CARGAR EJECUCIONES (cantidad_real > 0)
    tareas.forEach(tarea => {
      if (tarea.items && tarea.items.length > 0) {
        tarea.items.forEach(item => {
          const cantReal = Number(item.cantidad_real) || 0;

          if (cantReal > 0) {
            const actId = item.actividad_id || item.sub_actividad_id;

            if (!actividadesMap[actId]) {
              actividadesMap[actId] = {
                actividad_id: actId,
                nombre_actividad: item.actividad?.nombre || item.sub_actividad?.nombre || 'Actividad',
                unidad: item.actividad?.unidad || item.sub_actividad?.unidad || 'UN',
                cantidad_cubicada: 0,
                cantidad_ejecutada: 0,
                costo_ejecutado: 0,
                tareas_realizadas: []
              };
            }

            const costo = cantReal * (item.precio_costo_unitario || 0);

            // NUEVO: Calculo de Venta
            const precioVenta = Number(item.precio_venta_unitario) || Number(item.actividad?.valor_venta) || Number(item.sub_actividad?.valor_venta) || 0;
            const venta = cantReal * precioVenta;

            actividadesMap[actId].cantidad_ejecutada += cantReal;
            actividadesMap[actId].costo_ejecutado += costo;
            actividadesMap[actId].tareas_realizadas.push({
              tarea_id: tarea.id,
              cantidad: cantReal,
              precio_unitario: item.precio_costo_unitario || 0,
              costo: costo,
              // Data Venta
              precio_venta: precioVenta,
              venta: venta,
              // Data Descriptiva
              proveedor: tarea.proveedor?.nombre || 'Somyl',
              trabajador: tarea.trabajador?.nombre_completo || '-',
              zona: tarea.zona?.nombre || '-',
              tramo: tarea.tramo?.nombre || '-',
              fecha_asignacion: tarea.fecha_asignacion,
              fecha_termino: tarea.fecha_termino_real,
              estado_ep: tarea.estado_pago?.estado || 'NO EMITIDO',
              nombre_actividad: actividadesMap[actId].nombre_actividad, // Para exportar
              unidad: actividadesMap[actId].unidad // Para exportar
            });
          }
        });
      }
    });

    // 3. FILTRAR: Solo mostrar si tiene cubicación O ejecución
    const actividadesFiltradas = Object.values(actividadesMap).filter(
      act => act.cantidad_cubicada > 0 || act.cantidad_ejecutada > 0
    );

    // 4. CALCULAR TOTALES
    const nuevosTotales = actividadesFiltradas.reduce(
      (acc, act) => ({
        cubicado: acc.cubicado + act.cantidad_cubicada,
        ejecutado: acc.ejecutado + act.cantidad_ejecutada,
        costo_ejecutado: acc.costo_ejecutado + act.costo_ejecutado
      }),
      { cubicado: 0, ejecutado: 0, costo_ejecutado: 0 }
    );

    setTotales(nuevosTotales);
    setActividadesAgrupadas(actividadesFiltradas.sort((a, b) => a.nombre_actividad.localeCompare(b.nombre_actividad)));
  };

  const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('es-CL').format(val);
  const formatFecha = (fecha) => {
    if (!fecha) return '-';
    return format(parseISO(fecha), 'dd/MM/yyyy HH:mm', { locale: es });
  };

  // --- EXPORTAR EXCEL (AGRUPADO POR ZONA) ---
  const handleExportExcel = () => {
    try {
      const ws_data = [];
      ws_data.push(["ZONA", "ÍTEM / ACTIVIDAD", "UNIDAD", "FECHA", "CONTRATISTA / TRAB.", "CANTIDAD", "PRECIO COSTO", "TOTAL COSTO", "PRECIO VENTA", "TOTAL VENTA", "ESTADO PAGO"]);

      // 1. Aplanar todas las ejecuciones de todas las actividades
      let allExecutions = [];
      actividadesAgrupadas.forEach(act => {
        if (act.tareas_realizadas && act.tareas_realizadas.length > 0) {
          // Ya agregamos nombre_actividad y unidad en el paso anterior
          allExecutions = [...allExecutions, ...act.tareas_realizadas];
        }
      });

      // 2. Agrupar por Zona
      const executionsByZone = allExecutions.reduce((acc, curr) => {
        const zonaName = curr.zona || 'SIN ZONA';
        if (!acc[zonaName]) acc[zonaName] = [];
        acc[zonaName].push(curr);
        return acc;
      }, {});

      // 3. Ordenar Zonas alfabéticamente
      const sortedZones = Object.keys(executionsByZone).sort();

      let granTotalCosto = 0;
      let granTotalVenta = 0;

      sortedZones.forEach(zona => {
        // Header de Zona
        ws_data.push([zona.toUpperCase(), "", "", "", "", "", "", "", "", "", ""]);

        const items = executionsByZone[zona];
        // Ordenar items por fecha o nombre
        items.sort((a, b) => new Date(a.fecha_termino) - new Date(b.fecha_termino));

        let totalZonaCosto = 0;
        let totalZonaVenta = 0;

        items.forEach(item => {
          const totalCosto = Number(item.costo) || 0;
          const totalVenta = Number(item.venta) || 0;

          ws_data.push([
            "", // Columna Zona vacía para items
            item.nombre_actividad,
            item.unidad,
            item.fecha_termino ? format(parseISO(item.fecha_termino), 'dd/MM/yyyy') : '-',
            item.proveedor !== 'Somyl' ? item.proveedor : item.trabajador,
            Number(item.cantidad),
            Number(item.precio_unitario),
            totalCosto,
            Number(item.precio_venta),
            totalVenta,
            item.estado_ep
          ]);

          totalZonaCosto += totalCosto;
          totalZonaVenta += totalVenta;
        });

        // Footer de Zona
        ws_data.push(["TOTAL " + zona, "", "", "", "", "", "", totalZonaCosto, "", totalZonaVenta, ""]);
        ws_data.push([]); // Espacio separador

        granTotalCosto += totalZonaCosto;
        granTotalVenta += totalZonaVenta;
      });

      // Footer General
      ws_data.push(["TOTAL GENERAL", "", "", "", "", "", "", granTotalCosto, "", granTotalVenta, ""]);

      // Generar Excel
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produccion_Zonas");
      XLSX.writeFile(wb, `Reporte_Produccion_Zonas_${projectId}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);

    } catch (error) {
      console.error("Error exportando excel:", error);
      setError("Error al generar el archivo Excel.");
    }
  };

  const handleVerDetalles = (actividad) => {
    setActividadSeleccionada(actividad);
    setTareasDeActividad(actividad.tareas_realizadas);
    setShowModal(true);
  };

  if (loading) return <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>;

  return (
    <div className="container-fluid py-4 bg-light min-vh-100">

      {/* TITLE & ACTIONS */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-0">Producción por Actividad</h4>
          <small className="text-muted">Detalle de todas las actividades ejecutadas (emitidas y sin emitir)</small>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="success"
            className="shadow-sm"
            onClick={handleExportExcel}
            disabled={loading || actividadesAgrupadas.length === 0}
          >
            <i className="bi bi-file-earmark-excel me-2"></i>Exportar Excel
          </Button>
          <Button variant="outline-danger" className="shadow-sm" onClick={() => window.print()}>
            <i className="bi bi-file-pdf me-2"></i>PDF
          </Button>
        </div>
      </div>

      {error && <Alert variant="warning">{error}</Alert>}

      {/* KPI GLOBAL */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <div className="mb-3">
                <h6 className="text-uppercase text-muted fw-bold small">Producción Total Cubicada</h6>
                <h3 className="fw-bold text-primary mb-0">{formatNumber(totales.cubicado)}</h3>
              </div>
            </Col>
            <Col md={6}>
              <div className="mb-3">
                <h6 className="text-uppercase text-muted fw-bold small">Producción Total Ejecutada</h6>
                <h3 className="fw-bold text-success mb-0">{formatNumber(totales.ejecutado)}</h3>
                <small className="text-muted">Costo: {formatMoney(totales.costo_ejecutado)}</small>
              </div>
            </Col>
          </Row>
          <hr />
          <Row>
            <Col md={12}>
              <small className="text-muted fw-bold">% Avance Global</small>
              <ProgressBar
                now={totales.cubicado > 0 ? (totales.ejecutado / totales.cubicado * 100) : 0}
                label={`${Math.round(totales.cubicado > 0 ? (totales.ejecutado / totales.cubicado * 100) : 0)}%`}
                className="mt-2"
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* TABLA */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0 fw-bold">Contraste Cubicación vs Ejecución ({actividadesAgrupadas.length} actividades)</h6>
        </Card.Header>
        <Card.Body className="p-0">
          {actividadesAgrupadas.length === 0 ? (
            <Alert variant="info" className="m-4 mb-0">No hay datos de cubicación o producción disponibles.</Alert>
          ) : (
            <Table hover responsive className="mb-0 align-middle small">
              <thead className="bg-light text-secondary text-uppercase">
                <tr>
                  <th className="py-3 ps-4">Actividad</th>
                  <th className="py-3 text-center">Unidad</th>
                  <th className="py-3 text-end">Cant. Cubicada</th>
                  <th className="py-3 text-end text-success fw-bold">Cant. Ejecutada</th>
                  <th className="py-3 text-end">Total Costo</th>
                  <th className="py-3 text-center">% Avance</th>
                  <th className="py-3 text-center" style={{ width: '80px' }}>Tareas</th>
                  <th className="py-3 text-center pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {actividadesAgrupadas.map((actividad) => {
                  const porcentajeAvance = actividad.cantidad_cubicada > 0
                    ? Math.round((actividad.cantidad_ejecutada / actividad.cantidad_cubicada) * 100)
                    : (actividad.cantidad_ejecutada > 0 ? 100 : 0);

                  return (
                    <tr key={actividad.actividad_id}>
                      <td className="ps-4 fw-medium text-dark">{actividad.nombre_actividad}</td>
                      <td className="text-center text-muted">{actividad.unidad}</td>
                      <td className="text-end fw-semibold text-primary">{formatNumber(actividad.cantidad_cubicada)}</td>
                      <td className="text-end fw-bold text-success">{formatNumber(actividad.cantidad_ejecutada)}</td>
                      <td className="text-end fw-bold text-success">{formatMoney(actividad.costo_ejecutado)}</td>
                      <td className="text-center">
                        <div className="d-flex align-items-center gap-2">
                          <ProgressBar
                            now={porcentajeAvance}
                            className="flex-grow-1"
                            style={{ height: '20px' }}
                          />
                          <span className="fw-bold small text-nowrap">{porcentajeAvance}%</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <Badge bg="light" text="dark" className="border">{actividad.tareas_realizadas.length}</Badge>
                      </td>
                      <td className="text-center pe-4">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleVerDetalles(actividad)}
                        >
                          <i className="bi bi-eye"></i>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {actividadesAgrupadas.length > 0 && (
                <tfoot className="bg-light fw-bold">
                  <tr>
                    <td className="ps-4 text-uppercase" colSpan="2">Totales</td>
                    <td className="text-end text-primary">{formatNumber(totales.cubicado)}</td>
                    <td className="text-end text-success">{formatNumber(totales.ejecutado)}</td>
                    <td className="text-end text-success">{formatMoney(totales.costo_ejecutado)}</td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* MODAL DE DETALLES */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            Detalle de Tareas - {actividadSeleccionada?.nombre_actividad}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tareasDeActividad.length === 0 ? (
            <Alert variant="info" className="mb-0">No hay tareas para esta actividad.</Alert>
          ) : (
            <Table hover size="sm" className="small">
              <thead className="bg-light">
                <tr>
                  <th>Proveedor</th>
                  <th>Trabajador</th>
                  <th className="text-center">Zona</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-end">Costo</th>
                  <th className="text-center">Fecha Inicio</th>
                  <th className="text-center">Fecha Fin</th>
                  <th className="text-center">Estado EP</th>
                </tr>
              </thead>
              <tbody>
                {tareasDeActividad.map((tarea, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{tarea.proveedor}</td>
                    <td className="text-muted">{tarea.trabajador}</td>
                    <td className="text-center">
                      <Badge bg="light" text="dark" className="small">
                        {tarea.zona} {tarea.tramo && `- ${tarea.tramo}`}
                      </Badge>
                    </td>
                    <td className="text-center fw-bold">{tarea.cantidad}</td>
                    <td className="text-end fw-semibold">{formatMoney(tarea.costo)}</td>
                    <td className="text-center small">{formatFecha(tarea.fecha_asignacion)}</td>
                    <td className="text-center small">{formatFecha(tarea.fecha_termino)}</td>
                    <td className="text-center">
                      <Badge
                        bg={tarea.estado_ep === 'EMITIDO' ? 'success' : 'warning'}
                        text={tarea.estado_ep === 'EMITIDO' ? 'white' : 'dark'}
                      >
                        {tarea.estado_ep}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="fw-bold bg-light border-top">
                <tr>
                  <td colSpan="3"></td>
                  <td className="text-center">
                    {formatNumber(tareasDeActividad.reduce((sum, t) => sum + t.cantidad, 0))}
                  </td>
                  <td className="text-end">
                    {formatMoney(tareasDeActividad.reduce((sum, t) => sum + t.costo, 0))}
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ProduccionActividad;