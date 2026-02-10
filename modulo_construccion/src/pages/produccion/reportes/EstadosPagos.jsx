import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Table, Spinner, Badge, Alert, Modal, Form, Row, Col, Card } from 'react-bootstrap';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Select from 'react-select';
import DocumentoEP from '../../../components/pdf/DocumentoEP';
import { estadosPagoService } from '../../../services/estadosPagoService';
import { tareasService } from '../../../services/tareasService';

const EstadosPagos = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [eps, setEps] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filterEstado, setFilterEstado] = useState('todos'); // 'todos', 'emitido', 'borrador'
  const [filterProveedor, setFilterProveedor] = useState(null);
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

  // Modal para visualización
  const [showModal, setShowModal] = useState(false);
  const [epSeleccionado, setEpSeleccionado] = useState(null);
  const [tareasDelEp, setTareasDelEp] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [projectId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todos los EP y tareas
      const [epsData, tareasData] = await Promise.all([
        estadosPagoService.getAll(projectId),
        tareasService.getTareas(projectId)
      ]);

      setEps(epsData || []);
      setTareas(tareasData || []);

    } catch (err) {
      console.error(err);
      setError("Error al cargar Estados de Pago.");
    } finally {
      setLoading(false);
    }
  };

  // Obtener opciones de proveedores
  const proveedoresOpts = Array.from(
    new Map(
      eps
        .filter(e => e.proveedor)
        .map(e => [e.proveedor.id, { value: e.proveedor.id, label: e.proveedor.nombre }])
    ).values()
  );

  // Filtrar EPs
  const epsFiltrados = eps.filter(ep => {
    if (filterEstado !== 'todos' && ep.estado !== filterEstado) return false;
    if (filterProveedor && ep.proveedor_id !== filterProveedor.value) return false;
    if (filterFechaDesde && new Date(ep.fecha_creacion || '') < new Date(filterFechaDesde)) return false;
    if (filterFechaHasta && new Date(ep.fecha_creacion || '') > new Date(filterFechaHasta)) return false;
    return true;
  }).sort((a, b) => new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0));

  const handleVerDetalles = (ep) => {
    setEpSeleccionado(ep);

    // Cargar tareas asociadas a este EP
    const tareasAsociadas = tareas.filter(t => t.estado_pago_id === ep.id);
    setTareasDelEp(tareasAsociadas);

    setShowModal(true);
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount || 0);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '-';
    return format(parseISO(fecha), 'dd/MM/yyyy', { locale: es });
  };

  const getEstadoBadge = (estado) => {
    const config = {
      BORRADOR: { bg: 'warning', text: 'dark', label: 'Borrador' },
      EMITIDO: { bg: 'success', text: 'white', label: 'Emitido' },
      PAGADO: { bg: 'info', text: 'white', label: 'Pagado' }
    };
    const c = config[estado] || config.BORRADOR;
    return <Badge bg={c.bg} text={c.text}>{c.label}</Badge>;
  };

  if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><Spinner animation="border" variant="primary" /></div>;

  return (
    <div className="container-fluid py-4 bg-light min-vh-100">

      {/* ENCABEZADO */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>

          <h4 className="fw-bold text-dark mb-0">Estados de Pago</h4>
          <small className="text-muted">Gestión y control de emisiones</small>
        </div>
        <div>
          <Button variant="outline-success" size="sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>Imprimir Listado
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* FILTROS */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Label className="small fw-bold text-muted mb-1">Estado</Form.Label>
              <Form.Select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                size="sm"
              >
                <option value="todos">Todos</option>
                <option value="BORRADOR">Borradores</option>
                <option value="EMITIDO">Emitidos</option>
                <option value="PAGADO">Pagados</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold text-muted mb-1">Proveedor</Form.Label>
              <Select
                isClearable
                options={proveedoresOpts}
                value={filterProveedor}
                onChange={setFilterProveedor}
                placeholder="Todos..."
                styles={{
                  control: (base) => ({ ...base, minHeight: '32px', fontSize: '0.875rem' })
                }}
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-muted mb-1">Desde</Form.Label>
              <Form.Control
                type="date"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
                size="sm"
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-muted mb-1">Hasta</Form.Label>
              <Form.Control
                type="date"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
                size="sm"
              />
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setFilterEstado('todos');
                  setFilterProveedor(null);
                  setFilterFechaDesde('');
                  setFilterFechaHasta('');
                }}
                className="w-100"
              >
                Limpiar
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* TABLA */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0 fw-bold">Listado de Estados de Pago ({epsFiltrados.length})</h6>
        </Card.Header>
        <Card.Body className="p-0">
          {epsFiltrados.length === 0 ? (
            <Alert variant="info" className="m-4 mb-0">No hay Estados de Pago que coincidan con los filtros.</Alert>
          ) : (
            <Table hover responsive className="mb-0 align-middle small">
              <thead className="bg-light text-secondary text-uppercase">
                <tr>
                  <th className="py-3 ps-4 border-0" style={{ fontSize: '0.75rem' }}>Código</th>
                  <th className="py-3 border-0" style={{ fontSize: '0.75rem' }}>Proveedor</th>
                  <th className="py-3 text-center border-0" style={{ fontSize: '0.75rem' }}>Estado</th>
                  <th className="py-3 border-0" style={{ fontSize: '0.75rem' }}>Fecha Emisión</th>
                  <th className="py-3 border-0" style={{ fontSize: '0.75rem' }}>Tareas</th>
                  <th className="py-3 text-end border-0" style={{ fontSize: '0.75rem' }}>Monto</th>
                  <th className="py-3 text-center pe-4 border-0" style={{ fontSize: '0.75rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {epsFiltrados.map((ep) => (
                  <tr key={ep.id}>
                    <td className="ps-4 fw-semibold">
                      <span className="text-primary">{ep.codigo}</span>
                    </td>
                    <td className="text-dark fw-semibold">
                      {ep.proveedor?.nombre || '-'}
                    </td>
                    <td className="text-center">
                      {getEstadoBadge(ep.estado)}
                    </td>
                    <td className="text-muted">
                      {formatFecha(ep.fecha_emision || ep.fecha_creacion)}
                    </td>
                    <td className="text-center">
                      <Badge bg="light" text="dark" className="border">
                        {tareas.filter(t => t.estado_pago_id === ep.id).length}
                      </Badge>
                    </td>
                    <td className="text-end fw-bold">
                      {formatMoney(
                        tareas
                          .filter(t => t.estado_pago_id === ep.id)
                          .reduce((sum, t) => {
                            if (t.items && t.items.length > 0) {
                              return sum + t.items.reduce((s, i) => s + ((i.cantidad_real || i.cantidad_asignada || 0) * (i.precio_costo_unitario || 0)), 0);
                            }
                            return sum + ((t.cantidad_real || 0) * (t.precio_costo_unitario || 0));
                          }, 0)
                      )}
                    </td>
                    <td className="text-center pe-4">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleVerDetalles(ep)}
                        className="me-1"
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                      {ep.estado === 'EMITIDO' && (
                        <PDFDownloadLink
                          document={<DocumentoEP epData={ep} tareas={tareas.filter(t => t.estado_pago_id === ep.id)} proyectoInfo={{}} />}
                          fileName={`${ep.codigo}.pdf`}
                        >
                          {({ loading: pdfLoading }) => (
                            <Button
                              variant="outline-success"
                              size="sm"
                              disabled={pdfLoading}
                            >
                              <i className="bi bi-file-pdf"></i>
                            </Button>
                          )}
                        </PDFDownloadLink>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* MODAL DE DETALLES */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            {epSeleccionado?.codigo}
            {getEstadoBadge(epSeleccionado?.estado)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {epSeleccionado && (
            <div>
              {/* Info EP */}
              <Row className="mb-4">
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted fw-bold">Proveedor</small>
                    <p className="fw-semibold mb-0">{epSeleccionado.proveedor?.nombre || '-'}</p>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted fw-bold">Correo</small>
                    <p className="mb-0 small">{epSeleccionado.proveedor?.email || '-'}</p>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted fw-bold">Fecha de Emisión</small>
                    <p className="fw-semibold mb-0">{formatFecha(epSeleccionado.fecha_emision || epSeleccionado.fecha_creacion)}</p>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted fw-bold">Estado</small>
                    <p className="mb-0">{getEstadoBadge(epSeleccionado.estado)}</p>
                  </div>
                </Col>
              </Row>

              {/* Tareas */}
              <hr />
              <h6 className="fw-bold mb-3">Tareas Asociadas ({tareasDelEp.length})</h6>
              {tareasDelEp.length === 0 ? (
                <Alert variant="info" className="mb-0">No hay tareas asociadas.</Alert>
              ) : (
                <Table size="sm" hover className="small">
                  <thead className="bg-light">
                    <tr>
                      <th>Actividad</th>
                      <th className="text-center">Zona</th>
                      <th className="text-center">Cant.</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tareasDelEp.flatMap(t =>
                      (t.items && t.items.length > 0)
                        ? t.items.map((item, idx) => (
                          <tr key={`${t.id}-${idx}`}>
                            <td>{item.actividad?.nombre || item.sub_actividad?.nombre}</td>
                            <td className="text-center"><Badge bg="light" text="dark">{t.zona?.nombre}</Badge></td>
                            <td className="text-center">{item.cantidad_real || item.cantidad_asignada}</td>
                            <td className="text-end fw-semibold">
                              {formatMoney((item.cantidad_real || item.cantidad_asignada || 0) * (item.precio_costo_unitario || 0))}
                            </td>
                          </tr>
                        ))
                        : (
                          <tr>
                            <td>{t.actividad?.nombre || t.sub_actividad?.nombre}</td>
                            <td className="text-center"><Badge bg="light" text="dark">{t.zona?.nombre}</Badge></td>
                            <td className="text-center">{t.cantidad_real || t.cantidad_asignada}</td>
                            <td className="text-end fw-semibold">
                              {formatMoney((t.cantidad_real || 0) * (t.precio_costo_unitario || 0))}
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                  <tfoot className="fw-bold bg-light">
                    <tr>
                      <td colSpan="3" className="text-end">Total:</td>
                      <td className="text-end">
                        {formatMoney(
                          tareasDelEp.reduce((sum, t) => {
                            if (t.items && t.items.length > 0) {
                              return sum + t.items.reduce((s, i) => s + ((i.cantidad_real || i.cantidad_asignada || 0) * (i.precio_costo_unitario || 0)), 0);
                            }
                            return sum + ((t.cantidad_real || 0) * (t.precio_costo_unitario || 0));
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              )}

              {/* Acciones */}
              <hr />
              <div className="d-flex gap-2 justify-content-end">
                {epSeleccionado.estado === 'EMITIDO' && (
                  <PDFDownloadLink
                    document={<DocumentoEP epData={epSeleccionado} tareas={tareasDelEp} proyectoInfo={{}} />}
                    fileName={`${epSeleccionado.codigo}.pdf`}
                  >
                    {({ loading: pdfLoading }) => (
                      <Button
                        variant="success"
                        size="sm"
                        disabled={pdfLoading}
                      >
                        <i className="bi bi-file-pdf me-2"></i>Descargar PDF
                      </Button>
                    )}
                  </PDFDownloadLink>
                )}
                <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EstadosPagos;
