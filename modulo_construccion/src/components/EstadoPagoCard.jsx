// components/EstadoPagoCard.jsx
import React from 'react';
import { Card, Badge, Button, ProgressBar } from 'react-bootstrap';

const EstadoPagoCard = ({ ep, onEmitirClick, compact = false }) => {
    // Calculamos porcentaje de avance (ejemplo visual)
    const isEmitido = ep.estado === 'EMITIDO';

    if (compact) {
        return (
            <Card
                className="mb-2 border-0 shadow-sm"
                style={{
                    borderLeft: `3px solid ${isEmitido ? '#6f42c1' : '#ffc107'}`,
                    cursor: 'pointer',
                    transition: 'transform 0.1s'
                }}
                onClick={() => onEmitirClick(ep)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
                <Card.Body className="p-1.5">
                    {/* Header: Código + Badge */}
                    <div className="d-flex justify-content-between align-items-center mb-0.5">
                        <span className="fw-bold text-dark text-[11px]">{ep.codigo}</span>
                        <Badge bg={isEmitido ? 'purple' : 'warning'} text={isEmitido ? 'white' : 'dark'} style={{ fontSize: '10px', padding: '0.2em 0.4em' }}>
                            {ep.estado === 'EMITIDO' ? 'EMITIDO' : 'PAGADO'}
                        </Badge>
                    </div>

                    {/* Body: Proveedor (Truncado) */}
                    <div className="mb-0.5 text-truncate" title={ep.proveedor?.nombre || 'Desconocido'}>
                        <small className="text-secondary fw-semibold text-[10px]">
                            <i className="bi bi-building me-1"></i>
                            {ep.proveedor?.nombre?.substring(0, 18) || 'Prov. Desconocido'}
                            {ep.proveedor?.nombre?.length > 18 ? '...' : ''}
                        </small>
                    </div>

                    {/* Footer: Monto */}
                    <div className="d-flex justify-content-between align-items-center mt-1.5 border-top pt-1 text-[10px]">
                        <small className="text-muted">{ep.cantidad_items || 0} It.</small>
                        <span className="fw-bold text-dark">
                            ${Number(ep.monto_total || 0).toLocaleString('es-CL')}
                        </span>
                    </div>
                </Card.Body>
            </Card>
        )
    }

    return (
        <Card className="mb-3 border-0 shadow-sm" style={{ borderLeft: `4px solid ${isEmitido ? '#6f42c1' : '#ffc107'}` }}>
            <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 className="fw-bold text-dark mb-0">{ep.codigo}</h6>
                        <small className="text-muted text-uppercase" style={{ fontSize: '0.75rem' }}>{ep.nombre}</small>
                    </div>
                    <Badge bg={isEmitido ? 'purple' : 'warning'} text={isEmitido ? 'white' : 'dark'}>
                        {ep.estado}
                    </Badge>
                </div>

                {/* Info del Proveedor */}
                <div className="mb-3 p-2 bg-light rounded border d-flex align-items-center gap-2">
                    <i className="bi bi-building text-secondary"></i>
                    <span className="small fw-bold text-secondary">
                        {ep.proveedor?.nombre || 'Proveedor Desconocido'}
                    </span>
                </div>

                {/* Totales Monetarios (La suma de las tarjetas hijas) */}
                <div className="d-flex justify-content-between align-items-end mb-3">
                    <div className="text-start">
                        <small className="d-block text-muted" style={{ fontSize: '10px' }}>TOTAL NETO</small>
                        <span className="fw-bold text-dark fs-5">
                            ${Number(ep.monto_total || 0).toLocaleString('es-CL')}
                        </span>
                    </div>
                    <div className="text-end">
                        <small className="d-block text-muted" style={{ fontSize: '10px' }}>ITEMS</small>
                        <span className="badge bg-secondary rounded-pill">
                            {ep.cantidad_items || 0} Tarjetas
                        </span>
                    </div>
                </div>

                {/* Botón de Acción Principal */}
                <div className="d-grid">
                    <Button
                        variant={isEmitido ? "outline-secondary" : "primary"}
                        size="sm"
                        onClick={() => onEmitirClick(ep)}
                    >
                        {isEmitido ? <><i className="bi bi-eye me-2"></i>Ver Detalle</> : <><i className="bi bi-file-earmark-check me-2"></i>Emitir / Gestionar</>}
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

export default EstadoPagoCard;