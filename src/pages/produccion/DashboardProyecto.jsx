import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap'
import { proyectosService } from '../../services/proyectosService'

function DashboardProyecto() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [proyectoExists, setProyectoExists] = useState(false)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        await proyectosService.getById(projectId)
        setProyectoExists(true)
      } catch (err) {
        setError('No se pudo cargar el proyecto.')
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [projectId])

  const ModuleCard = ({ title, desc, icon, color, link, active = true }) => {
    // helper: convierte hex a rgba para fondos sutiles
    const hexToRgba = (hex, alpha = 0.12) => {
      const h = hex.replace('#', '')
      const bigint = parseInt(h, 16)
      const r = (bigint >> 16) & 255
      const g = (bigint >> 8) & 255
      const b = bigint & 255
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    return (
      <Card
        className="h-auto border module-card"
        style={{
          cursor: active ? 'pointer' : 'default',
          opacity: active ? 1 : 0.65,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: 'none',
          borderColor: '#e6eef7'
        }}
        onClick={() => active && navigate(link)}
      >
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            background: active ? hexToRgba(color, 0.12) : '#f1f5f9',
            height: '78px',
            width: '100%'
          }}
        >
          <i className={`bi ${icon}`} style={{ fontSize: '1.6rem', color: color }}></i>
        </div>
        <Card.Body className="text-center p-3" style={{ paddingTop: '12px', paddingBottom: '14px' }}>
          <h6 className="fw-semibold mb-1 text-dark" style={{ fontSize: '14px' }}>{title}</h6>
          <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>{desc}</p>
        </Card.Body>
      </Card>
    )
  }

  const StatWidget = ({ label, value, icon, color }) => (
    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
      <Card.Body className="d-flex align-items-center gap-3 py-3 px-4">
        <div 
          className="d-flex align-items-center justify-content-center rounded-circle"
          style={{ width: '48px', height: '48px', background: `${color}15`, color: color }}
        >
          <i className={`bi ${icon} fs-4`}></i>
        </div>
        <div>
          <h4 className="mb-0 fw-bold text-dark">{value}</h4>
          <small className="text-muted fw-semibold" style={{ fontSize: '12px' }}>{label}</small>
        </div>
      </Card.Body>
    </Card>
  )

  if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><Spinner animation="border" variant="primary" /></div>
  if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>
  
  return (
    <div style={{ background: '#f8fafc', minHeight: 'calc(100vh - 64px)' }} className="py-4">
      <Container>
        {/* Widgets removed: Cuadrillas Activas, Actividades Hoy, Incidentes
            Reservado para estado financiero u otros widgets futuros */}

        {/* Nuevo layout en columnas con títulos y tarjetas apiladas */}
        <Row className="g-4 mt-4">
          <Col xs={12} md={3}>
            <h6 className="text-muted fw-bold text-uppercase mb-3">Configuraciones</h6>
            <div className="d-flex flex-column gap-3">
              <ModuleCard 
                title="Cuadrillas" 
                desc="Gestión de subcontratos y trabajadores."
                icon="bi-people-fill"
                color="#0ea5e9" 
                link={`/proyecto/${projectId}/cuadrillas`}
                active={true}
              />
              <ModuleCard
                title="Actividades"
                desc="Planifica y gestiona actividades diarias."
                icon="bi-list-task"
                color="#ef4444"
                link={`/proyecto/${projectId}/actividades`}
                active={true}
              />
              <ModuleCard
                title="Cubicaciones"
                desc="Cálculos y mediciones de volúmenes."
                icon="bi-calculator"
                color="#7c3aed"
                link={`/proyecto/${projectId}/cubicaciones`}
                active={true}
              />
              <ModuleCard
                title="Zonas y Tramos"
                desc="Definición geográfica y trazados."
                icon="bi-map-fill"
                color="#64748b"
                link={`/proyecto/${projectId}/zonas`}
                active={true}
              />
            </div>
          </Col>

          <Col xs={12} md={3}>
            <h6 className="text-muted fw-bold text-uppercase mb-3">Procesos</h6>
            <div className="d-flex flex-column gap-3">
              <ModuleCard
                title="Asignar Actividad"
                desc="Asignación rápida de tareas a cuadrillas."
                icon="bi-arrow-right-square"
                color="#0f172a"
                link={`/proyecto/${projectId}/tareas`}
                active={true}
              />
              <ModuleCard
                title="Registro de Actividad"
                desc="Ingreso diario de actividades ejecutadas."
                icon="bi-journal-text"
                color="#f59e0b"
                link={`/proyecto/${projectId}/tareas?view=historial`}
                active={true}
              />
            </div>
          </Col>

          <Col xs={12} md={3}>
            <h6 className="text-muted fw-bold text-uppercase mb-3">Registros de Gastos</h6>
            <div className="d-flex flex-column gap-3">
              <ModuleCard
                title="Gastos de Cuadrillas"
                desc="Control y registro de pagos por cuadrilla."
                icon="bi-cash-stack"
                color="#10b981"
                link={`/proyecto/${projectId}/gastos/cuadrillas`}
                active={true}
              />
            </div>
          </Col>

          <Col xs={12} md={3}>
            <h6 className="text-muted fw-bold text-uppercase mb-3">Reportes</h6>
            <div className="d-flex flex-column gap-3">
              <ModuleCard
                title="Producción según Actividad"
                desc="Reporte de producción por actividad."
                icon="bi-bar-chart-line"
                color="#6366f1"
                link={`/proyecto/${projectId}/reportes/produccion-actividad`}
                active={true}
              />
              <ModuleCard
                title="Resumen Por Sub contrato"
                desc="Resumen financiero por proveedor."
                icon="bi-people"
                color="#8b5cf6"
                link={`/proyecto/${projectId}/reportes/resumen-subcontrato`}
                active={true}
              />
              <ModuleCard
                title="Estado de Pagos"
                desc="Control de estados y vencimientos."
                icon="bi-receipt"
                color="#ef4444"
                link={`/proyecto/${projectId}/reportes/estado-pagos`}
                active={true}
              />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default DashboardProyecto