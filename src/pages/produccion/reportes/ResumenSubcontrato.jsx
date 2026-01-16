import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Spinner, Badge, Alert, Modal } from 'react-bootstrap';
import { reportesService } from '../../../services/reportesService';
import { tareasService } from '../../../services/tareasService';

const ResumenSubcontrato = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal para detalles
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ tipo: null, proveedor: null, tareas: [] });

  // Estado para los totales generales
  const [totales, setTotales] = useState({ 
      costo: 0, 
      venta: 0, 
      emitido: 0, 
      pendiente: 0 
  });

  useEffect(() => {
    cargarDatos();
  }, [projectId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todas las tareas del proyecto con sus relaciones
      const todasLasTareas = await tareasService.getTareas(projectId);

      // Agrupar por proveedor y calcular correctamente
      const proveedoresMap = {};
      
      todasLasTareas.forEach(tarea => {
        const provId = tarea.proveedor_id;
        const provNombre = tarea.proveedor?.nombre || `Proveedor ${provId}`;
        
        if (!proveedoresMap[provId]) {
          proveedoresMap[provId] = {
            proveedor_id: provId,
            nombre_proveedor: provNombre,
            trabajos_count: 0,
            tareas_produccion: [],      // Todas las tareas en REALIZADA
            tareas_emitidas: [],        // Tareas REALIZADA con EP EMITIDO
            tareas_pendientes: [],      // Tareas REALIZADA sin EP o EP no emitido
            produccion_costo: 0,
            produccion_venta: 0,
            monto_emitido: 0,
            monto_pendiente: 0
          };
        }
        
        const row = proveedoresMap[provId];
        
        // Contar solo tareas que tienen cantidad_real (ejecución registrada)
        if (tarea.cantidad_real > 0 || (tarea.items && tarea.items.some(i => i.cantidad_real > 0))) {
          row.trabajos_count++;
          
          // Expandir items si existen
          if (tarea.items && tarea.items.length > 0) {
            tarea.items.forEach(item => {
              const cantReal = item.cantidad_real || 0;
              const costo = cantReal * (item.precio_costo_unitario || 0);
              const venta = cantReal * (item.precio_venta_unitario || 0);
              
              row.tareas_produccion.push({
                tarea_id: tarea.id,
                item_id: item.id,
                nombre: item.actividad?.nombre || item.sub_actividad?.nombre || 'Actividad',
                cantidad: cantReal,
                precio_unitario: item.precio_costo_unitario || 0,
                costo: costo,
                venta: venta,
                estado_ep: tarea.estado_pago?.estado || null,
                codigo_ep: tarea.estado_pago?.codigo || null,
                tarea_estado: tarea.estado,
                zona: tarea.zona?.nombre || '-'
              });
              
              row.produccion_costo += costo;
              row.produccion_venta += venta;
              
              // Clasificar en emitido o pendiente
              if (tarea.estado_pago && tarea.estado_pago.estado === 'EMITIDO') {
                row.tareas_emitidas.push({...row.tareas_produccion[row.tareas_produccion.length - 1]});
                row.monto_emitido += costo;
              } else {
                row.tareas_pendientes.push({...row.tareas_produccion[row.tareas_produccion.length - 1]});
                row.monto_pendiente += costo;
              }
            });
          } else {
            // Fallback: tarea sin items (legacy)
            const cantReal = tarea.cantidad_real || 0;
            const costo = cantReal * (tarea.precio_costo_unitario || 0);
            const venta = cantReal * (tarea.precio_venta_unitario || 0);
            
            row.tareas_produccion.push({
              tarea_id: tarea.id,
              nombre: tarea.actividad?.nombre || tarea.sub_actividad?.nombre || 'Actividad',
              cantidad: cantReal,
              precio_unitario: tarea.precio_costo_unitario || 0,
              costo: costo,
              venta: venta,
              estado_ep: tarea.estado_pago?.estado || null,
              codigo_ep: tarea.estado_pago?.codigo || null,
              tarea_estado: tarea.estado,
              zona: tarea.zona?.nombre || '-'
            });
            
            row.produccion_costo += costo;
            row.produccion_venta += venta;
            
            if (tarea.estado_pago && tarea.estado_pago.estado === 'EMITIDO') {
              row.tareas_emitidas.push({...row.tareas_produccion[row.tareas_produccion.length - 1]});
              row.monto_emitido += costo;
            } else {
              row.tareas_pendientes.push({...row.tareas_produccion[row.tareas_produccion.length - 1]});
              row.monto_pendiente += costo;
            }
          }
        }
      });
      
      const dataFinal = Object.values(proveedoresMap);
      setData(dataFinal);

      // Calcular totales
      const newTotales = dataFinal.reduce((acc, row) => ({
        costo: acc.costo + row.produccion_costo,
        venta: acc.venta + row.produccion_venta,
        emitido: acc.emitido + row.monto_emitido,
        pendiente: acc.pendiente + row.monto_pendiente
      }), { costo: 0, venta: 0, emitido: 0, pendiente: 0 });
      
      setTotales(newTotales);

    } catch (err) {
      console.error(err);
      setError("Hubo un error al cargar los datos financieros.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleClickCell = (tipo, row) => {
    let tareas = [];
    
    if (tipo === 'produccion') {
      tareas = row.tareas_produccion;
    } else if (tipo === 'emitido') {
      tareas = row.tareas_emitidas;
    } else if (tipo === 'pendiente') {
      tareas = row.tareas_pendientes;
    }
    
    setModalData({
      tipo: tipo,
      proveedor: row.nombre_proveedor,
      tareas: tareas
    });
    setShowModal(true);
  };

  // Formateador de moneda CLP
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><Spinner animation="border" variant="primary" /></div>;

  return (
    <div className="container-fluid py-4 bg-light min-vh-100">
      
      {/* 1. ENCABEZADO LIMPIO */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="mb-2 border-0 ps-0">
            <i className="bi bi-arrow-left me-2"></i>Volver al Dashboard
          </Button>
          <h4 className="fw-bold text-dark mb-0">Resumen Financiero por Subcontrato</h4>
        </div>
        <div>
            <Button variant="outline-success" size="sm" onClick={() => window.print()}>
                <i className="bi bi-printer me-2"></i>Imprimir Reporte
            </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* 2. TARJETAS DE TOTALES (KPIs) */}
      <div className="row g-3 mb-4">
        {/* Costo Total (Producción Real) */}
        <div className="col-md-3">
          <Card className="border-0 shadow-sm border-start border-4 border-primary h-100">
            <Card.Body>
              <small className="text-muted text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Total Producción (Costo)</small>
              <h4 className="fw-bold text-dark mt-1 mb-0">{formatMoney(totales.costo)}</h4>
              <small className="text-muted" style={{fontSize: '0.7rem'}}>Lo que debes pagar a Subcontratos</small>
            </Card.Body>
          </Card>
        </div>

        {/* Venta Total (Ingreso) */}
        <div className="col-md-3">
          <Card className="border-0 shadow-sm border-start border-4 border-info h-100">
            <Card.Body>
              <small className="text-muted text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Total Venta (Estimado)</small>
              <h4 className="fw-bold text-dark mt-1 mb-0">{formatMoney(totales.venta)}</h4>
              <small className="text-muted" style={{fontSize: '0.7rem'}}>Lo que cobras al Cliente</small>
            </Card.Body>
          </Card>
        </div>

        {/* Pagado / Emitido */}
        <div className="col-md-3">
          <Card className="border-0 shadow-sm border-start border-4 border-success h-100">
            <Card.Body>
              <small className="text-muted text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Estados de Pago (Emitidos)</small>
              <h4 className="fw-bold text-success mt-1 mb-0">{formatMoney(totales.emitido)}</h4>
              <small className="text-muted" style={{fontSize: '0.7rem'}}>Deuda Saldada / Procesada</small>
            </Card.Body>
          </Card>
        </div>

        {/* Pendiente (Deuda) */}
        <div className="col-md-3">
          <Card className="border-0 shadow-sm border-start border-4 border-warning h-100">
            <Card.Body>
              <small className="text-muted text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Pendiente de Pago</small>
              <h4 className="fw-bold text-warning mt-1 mb-0">{formatMoney(totales.pendiente)}</h4>
              <small className="text-muted" style={{fontSize: '0.7rem'}}>Producción sin emitir</small>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* 3. TABLA DETALLADA */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
            <h6 className="mb-0 fw-bold">Detalle por Proveedor</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="py-3 ps-4 border-0">Subcontrato</th>
                <th className="py-3 text-center border-0">Tareas</th>
                <th className="py-3 text-end border-0">Producción ($)</th>
                <th className="py-3 text-end text-success border-0">Emitido ($)</th>
                <th className="py-3 text-end text-warning pe-4 border-0">Pendiente ($)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.proveedor_id}>
                  <td className="ps-4 fw-semibold text-dark">
                    {row.nombre_proveedor}
                  </td>
                  <td className="text-center">
                    <Badge bg="light" text="dark" className="border">{row.trabajos_count}</Badge>
                  </td>
                  <td className="text-end fw-bold text-secondary" style={{cursor: 'pointer'}} onClick={() => handleClickCell('produccion', row)}>
                    <span style={{textDecoration: 'underline'}}>{formatMoney(row.produccion_costo)}</span>
                  </td>
                  <td className="text-end text-success fw-medium" style={{cursor: 'pointer'}} onClick={() => handleClickCell('emitido', row)}>
                    <span style={{textDecoration: 'underline'}}>{formatMoney(row.monto_emitido)}</span>
                  </td>
                  <td className="text-end text-warning fw-bold pe-4" style={{cursor: 'pointer'}} onClick={() => handleClickCell('pendiente', row)}>
                    <span style={{textDecoration: 'underline'}}>{formatMoney(row.monto_pendiente)}</span>
                  </td>
                </tr>
              ))}
              
              {data.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted fst-italic">
                    No hay registros de producción con costo para este proyecto.
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* Pie de Tabla con Totales */}
            {data.length > 0 && (
                <tfoot className="bg-light fw-bold" style={{borderTop: '2px solid #e2e8f0'}}>
                    <tr>
                        <td className="ps-4 text-uppercase">Totales</td>
                        <td className="text-center">-</td>
                        <td className="text-end">{formatMoney(totales.costo)}</td>
                        <td className="text-end text-success">{formatMoney(totales.emitido)}</td>
                        <td className="text-end text-warning pe-4">{formatMoney(totales.pendiente)}</td>
                    </tr>
                </tfoot>
            )}
          </Table>
        </Card.Body>
      </Card>
      
      {/* MODAL DE DETALLES */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            Detalle - {modalData.proveedor}
            {modalData.tipo === 'produccion' && <Badge bg="primary" className="ms-2">Producción</Badge>}
            {modalData.tipo === 'emitido' && <Badge bg="success" className="ms-2">Emitido</Badge>}
            {modalData.tipo === 'pendiente' && <Badge bg="warning" text="dark" className="ms-2">Pendiente</Badge>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData.tareas.length === 0 ? (
            <Alert variant="info" className="mb-0">No hay tareas para esta categoría.</Alert>
          ) : (
            <Table hover size="sm">
              <thead className="bg-light">
                <tr>
                  <th>Actividad</th>
                  <th className="text-center">Zona</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-end">P. Unit</th>
                  <th className="text-end">Total</th>
                  {modalData.tipo === 'emitido' && <th className="text-center">EP</th>}
                </tr>
              </thead>
              <tbody>
                {modalData.tareas.map((t, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{t.nombre}</td>
                    <td className="text-center"><Badge bg="light" text="dark">{t.zona}</Badge></td>
                    <td className="text-center">{t.cantidad}</td>
                    <td className="text-end">{formatMoney(t.precio_unitario)}</td>
                    <td className="text-end fw-bold">{formatMoney(t.costo)}</td>
                    {modalData.tipo === 'emitido' && <td className="text-center"><small>{t.codigo_ep || '-'}</small></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot className="fw-bold bg-light border-top">
                <tr>
                  <td colSpan={modalData.tipo === 'emitido' ? 5 : 4} className="text-end">
                    Total:
                  </td>
                  <td className="text-end">
                    {formatMoney(modalData.tareas.reduce((sum, t) => sum + t.costo, 0))}
                  </td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ResumenSubcontrato;