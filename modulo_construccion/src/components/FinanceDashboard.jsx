import React, { useEffect, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { reportesService } from '../services/reportesService';
import { tareasService } from '../services/tareasService';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinanceDashboard({ projectId }) {
    const [kpis, setKpis] = useState({
        ingresos: 0,
        costos_mo: 0,
        gastos_op: 0,
        utilidad: 0,
        margen: 0
    });
    const [chartData, setChartData] = useState([]); // Para gráfico de barras
    const [pieData, setPieData] = useState([]);     // Para gráfico circular
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarDatosFinancieros();
    }, [projectId]);

    const cargarDatosFinancieros = async () => {
        try {
            setLoading(true);

            // 1. Carga paralela de datos (Tareas para cálculo real, Gastos Op del backend, Estado Financiero Neto)
            const [todasLasTareas, gastosOp, estadoFinanciero] = await Promise.all([
                tareasService.getTareas(projectId),
                reportesService.getGastosOperativos(projectId),    // Trae total gastos materiales
                reportesService.getEstadoFinancieroProyecto(projectId) // Nuevo: Gasto Neto y Deuda
            ]);

            // 2. Procesar Tareas para obtener Costos y Ventas Reales
            const proveedoresMap = {};
            let totalCostoMO = 0;
            let totalVenta = 0;

            todasLasTareas.forEach(tarea => {
                // Solo procesar si tiene ejecución real
                if (tarea.cantidad_real > 0 || (tarea.items && tarea.items.some(i => i.cantidad_real > 0))) {
                    const itemsProcesar = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];

                    itemsProcesar.forEach(item => {
                        const cantReal = Number(item.cantidad_real) || 0;
                        if (cantReal > 0) {
                            const costo = cantReal * (Number(item.precio_costo_unitario) || 0);
                            const venta = cantReal * (Number(item.precio_venta_unitario) || 0);

                            // Acumular Globales
                            totalCostoMO += costo;
                            totalVenta += venta;

                            // Acumular por Proveedor
                            const provId = tarea.proveedor?.id || 'sin_prov';
                            const provNombre = tarea.proveedor?.nombre || 'Proveedor Desconocido';

                            if (!proveedoresMap[provId]) {
                                proveedoresMap[provId] = {
                                    nombre_proveedor: provNombre,
                                    produccion_costo: 0,
                                    produccion_venta: 0
                                };
                            }
                            proveedoresMap[provId].produccion_costo += costo;
                            proveedoresMap[provId].produccion_venta += venta;
                        }
                    });
                }
            });

            // 3. Calcular Totales Finales
            const totalGastos = Number(gastosOp) || 0;
            const utilidad = totalVenta - totalCostoMO - totalGastos;
            const margen = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;

            setKpis({
                ingresos: totalVenta,
                costos_mo: totalCostoMO,
                gastos_op: totalGastos,
                utilidad,
                margen,
                gasto_realizado_neto: estadoFinanciero.total_gasto_neto,
                deuda_pendiente_neto: estadoFinanciero.saldo_pendiente_neto
            });

            // 4. Preparar Datos Gráfico Barras (Top 5 Proveedores por Costo)
            const topProveedores = Object.values(proveedoresMap)
                .sort((a, b) => b.produccion_costo - a.produccion_costo)
                .slice(0, 5)
                .map(p => ({
                    name: p.nombre_proveedor.length > 15 ? p.nombre_proveedor.substring(0, 15) + '...' : p.nombre_proveedor,
                    Costo: p.produccion_costo,
                    Venta: p.produccion_venta
                }));

            setChartData(topProveedores);

            // 5. Preparar Datos Gráfico Torta (Distribución de Gastos)
            setPieData([
                { name: 'Mano de Obra', value: totalCostoMO },
                { name: 'Materiales/Gastos', value: totalGastos }
            ]);

        } catch (error) {
            console.error("Error cargando dashboard financiero:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

    if (loading) return <div className="p-10 text-center text-slate-400 animate-pulse">Cargando métricas financieras...</div>;

    return (
        <div className="p-3 bg-slate-50 min-h-full">

            {/* 1. KPIs ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">

                {/* INGRESOS */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ingresos Totales</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.ingresos)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Producción Valorizada</div>
                </div>

                {/* COSTOS MO */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Costo Mano Obra</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.costos_mo)}</div>
                    <div className="text-[10px] text-red-400 mt-0.5">Subcontratos</div>
                </div>

                {/* GASTOS OPERATIVOS */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg"><Wallet size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gastos Operativos</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.gastos_op)}</div>
                    <div className="text-[10px] text-orange-400 mt-0.5">Materiales e Insumos</div>
                </div>

                {/* NUEVO: GASTO REALIZADO (NETO) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Wallet size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gasto Realizado (Neto)</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.gasto_realizado_neto || 0)}</div>
                    <div className="text-[10px] text-purple-400 mt-0.5">Órdenes de Pago</div>
                </div>

                {/* NUEVO: DEUDA PENDIENTE (NETO) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-pink-50 text-pink-600 rounded-lg"><AlertCircle size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Deuda Pendiente (Neto)</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.deuda_pendiente_neto || 0)}</div>
                    <div className="text-[10px] text-pink-400 mt-0.5">Por Pagar</div>
                </div>

                {/* UTILIDAD */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className={`absolute right-0 top-0 w-1.5 h-full ${kpis.utilidad >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div className="flex justify-between items-start mb-1">
                        <div className={`p-1.5 rounded-lg ${kpis.utilidad >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Utilidad Neta</span>
                    </div>
                    <div className={`text-xl font-bold ${kpis.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatMoney(kpis.utilidad)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                        Margen: {kpis.margen.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* 2. CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* BAR CHART: TOP PROVEEDORES */}
                <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart size={16} className="text-slate-400" />
                        Producción vs Costo (Top 5 Proveedores)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                                barGap={8}
                            >
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    tickFormatter={(value) => `$${value / 1000}k`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                                        fontSize: '12px',
                                        padding: '8px 12px'
                                    }}
                                    formatter={(value) => [formatMoney(value), '']}
                                />
                                <Legend
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}
                                />
                                <Bar dataKey="Venta" name="Venta Proyectada" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="Costo" name="Costo Real (MO)" fill="#475569" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* PIE CHART: DISTRIBUCIÓN */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <PieChart size={16} className="text-slate-400" />
                        Distribución de Costos
                    </h3>
                    <div className="flex-grow flex items-center justify-center">
                        <div className="h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#475569' : '#94a3b8'} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => formatMoney(value)}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-2 pt-3 border-top text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Total Gastado</span>
                        <div className="text-lg font-bold text-slate-700 leading-none">
                            {formatMoney(kpis.costos_mo + kpis.gastos_op)}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
