import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Spinner, ProgressBar, Alert } from 'react-bootstrap';
import { reportesService } from '../../../services/reportesService';

const ProduccionActividad = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Totales
  const [totales, setTotales] = useState({ presupuestado: 0, ejecutado: 0 });

  useEffect(() => {
    cargarDatos();
  }, [projectId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const reporteData = await reportesService.getProduccionActividad(projectId);
      setData(reporteData || []);

      // Calcular totales
      const tot = (reporteData || []).reduce((acc, row) => ({
        presupuestado: acc.presupuestado + Number(row.total_presupuestado),
        ejecutado: acc.ejecutado + Number(row.total_ejecutado)
      }), { presupuestado: 0, ejecutado: 0 });
      
      setTotales(tot);

    } catch (err) {
      console.error(err);
      setError("Error al cargar datos. Verifica que existan cubicaciones cargadas.");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('es-CL').format(val);

  if (loading) return <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>;

  // Calculamos % de avance general del proyecto (en dinero)
  const avanceGeneralRaw = totales.presupuestado > 0 
    ? (totales.ejecutado / totales.presupuestado) * 100
    : 0;
  // Mostrar con un decimal y coma como separador (ej: 1,7)
  const avanceGeneralDisplay = (Number.isFinite(avanceGeneralRaw) ? avanceGeneralRaw : 0).toFixed(1).replace('.', ',');
  const avanceGeneralForBar = Math.min(Number.isFinite(avanceGeneralRaw) ? avanceGeneralRaw : 0, 100);

  return (
    <div className="container-fluid py-4 bg-light min-vh-100">
      
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/proyecto/${projectId}`)} className="mb-2 border-0 ps-0">
            <i className="bi bi-arrow-left me-2"></i>Volver al Dashboard
          </Button>
          <h4 className="fw-bold text-dark mb-0">Producción por Actividad</h4>
        </div>
        <Button variant="outline-success" size="sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>Imprimir
        </Button>
      </div>

      {error && <Alert variant="warning">{error}</Alert>}

      {/* KPI GLOBAL */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="d-flex align-items-center justify-content-between">
            <div>
                <h6 className="text-uppercase text-muted fw-bold small">Avance Financiero Global</h6>
                <h2 className="fw-bold text-primary mb-0">{avanceGeneralDisplay}%</h2>
            </div>
            <div className="text-end">
                <div className="small text-muted">Total Ejecutado</div>
                <div className="fw-bold text-success fs-5">{formatMoney(totales.ejecutado)}</div>
                <div className="small text-muted border-top pt-1 mt-1">de {formatMoney(totales.presupuestado)}</div>
            </div>
        </Card.Body>
        <div className="px-3 pb-3">
            <ProgressBar now={avanceGeneralForBar} variant="primary" style={{height: '8px'}} />
        </div>
      </Card>

      {/* TABLA */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
            <h6 className="mb-0 fw-bold">Detalle de Avance</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle small">
            <thead className="bg-light text-secondary text-uppercase">
              <tr>
                <th className="py-3 ps-4">Actividad</th>
                <th className="py-3 text-center">Unidad</th>
                <th className="py-3 text-end">P. Unitario</th>
                <th className="py-3 text-end table-active">Cant. Presup.</th>
                <th className="py-3 text-end table-active">Total Presup.</th>
                <th className="py-3 text-end">Cant. Real</th>
                <th className="py-3 text-end text-success fw-bold">Total Real</th>
                <th className="py-3 text-center" style={{width: '150px'}}>% Avance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.actividad_id}>
                  <td className="ps-4 fw-medium text-dark">{row.nombre_actividad}</td>
                  <td className="text-center text-muted">{row.unidad}</td>
                  <td className="text-end text-muted">{formatMoney(row.precio_unitario)}</td>
                  
                  {/* Presupuesto */}
                  <td className="text-end bg-light fw-medium">{formatNumber(row.cant_presupuestada)}</td>
                  <td className="text-end bg-light text-secondary">{formatMoney(row.total_presupuestado)}</td>
                  
                  {/* Real */}
                  <td className="text-end fw-bold">{formatNumber(row.cant_ejecutada)}</td>
                  <td className="text-end text-success fw-bold">{formatMoney(row.total_ejecutado)}</td>
                  
                  {/* Barra de Progreso */}
                  <td className="text-center pe-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="flex-grow-1">
                            <ProgressBar now={Math.min(Number(row.porcentaje_avance) || 0, 100)} variant={Number(row.porcentaje_avance) > 100 ? 'danger' : 'success'} style={{height: '6px'}} />
                        </div>
                          <span className={`fw-bold ${Number(row.porcentaje_avance) > 100 ? 'text-danger' : 'text-dark'}`} style={{fontSize: '10px', minWidth: '35px'}}>
                            {(Number.isFinite(Number(row.porcentaje_avance)) ? Number(row.porcentaje_avance).toFixed(1).replace('.', ',') : '0,0')}%
                          </span>
                    </div>
                  </td>
                </tr>
              ))}
              
              {data.length === 0 && (
                <tr><td colSpan="8" className="text-center py-5 text-muted">No hay datos de producción disponibles.</td></tr>
              )}
            </tbody>
            
            {data.length > 0 && (
                <tfoot className="bg-light fw-bold">
                    <tr>
                        <td className="ps-4 text-uppercase">Totales</td>
                        <td colSpan="3"></td>
                        <td className="text-end">{formatMoney(totales.presupuestado)}</td>
                        <td></td>
                        <td className="text-end text-success">{formatMoney(totales.ejecutado)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            )}
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ProduccionActividad;