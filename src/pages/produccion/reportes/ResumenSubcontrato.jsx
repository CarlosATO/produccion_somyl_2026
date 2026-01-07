import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Spinner, Badge, Alert } from 'react-bootstrap';
import { reportesService } from '../../../services/reportesService';

const ResumenSubcontrato = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      // Optimización: Solo cargamos el reporte, ya no buscamos info del proyecto
      const reporteData = await reportesService.getResumenSubcontrato(projectId);

      setData(reporteData || []);

      // Calcular totales sumando las columnas
      const newTotales = (reporteData || []).reduce((acc, row) => ({
        costo: acc.costo + (Number(row.produccion_costo) || 0),
        venta: acc.venta + (Number(row.produccion_venta) || 0),
        emitido: acc.emitido + (Number(row.monto_emitido) || 0),
        pendiente: acc.pendiente + (Number(row.monto_pendiente) || 0)
      }), { costo: 0, venta: 0, emitido: 0, pendiente: 0 });
      
      setTotales(newTotales);

    } catch (err) {
      console.error(err);
      setError("Hubo un error al cargar los datos financieros.");
    } finally {
      setLoading(false);
    }
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
                  <td className="text-end fw-bold text-secondary">
                    {formatMoney(row.produccion_costo)}
                  </td>
                  <td className="text-end text-success fw-medium">
                    {formatMoney(row.monto_emitido)}
                  </td>
                  <td className="text-end text-warning fw-bold pe-4">
                    {formatMoney(row.monto_pendiente)}
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
    </div>
  );
};

export default ResumenSubcontrato;