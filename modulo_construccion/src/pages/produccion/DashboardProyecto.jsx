import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Container, Alert, Spinner } from 'react-bootstrap'
import { proyectosService } from '../../services/proyectosService'
import FinanceDashboard from '../../components/FinanceDashboard'

// ESTE ES EL DASHBOARD INTERNO (CONTENEDOR DEL PROYECTO)
function DashboardProyecto() {
  const { projectId } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [proyecto, setProyecto] = useState(null)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await proyectosService.getById(projectId)
        setProyecto(data)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el proyecto.')
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [projectId])

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center h-full bg-slate-50 gap-3">
      <Spinner animation="border" variant="primary" />
      <span className="text-slate-500 font-medium">Cargando...</span>
    </div>
  )

  if (error) return (
    <Container className="mt-4">
      <Alert variant="danger" className="shadow-sm border-0 rounded-xl">
        <h4 className="alert-heading font-bold">Error de Carga</h4>
        <p>{error}</p>
      </Alert>
    </Container>
  )

  return (
    <div className="h-full bg-slate-100 flex flex-col font-inter">
      {/* EL NAVBAR Y RIBBON YA VIENEN DEL LAYOUT PADRE */}

      {/* AREA DE TRABAJO PRINCIPAL */}
      <div className="flex-1 overflow-auto">
        <FinanceDashboard projectId={projectId} />
      </div>

    </div>
  )
}

export default DashboardProyecto