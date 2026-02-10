import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    ArrowRightSquare,
    FileText,
    Users,
    ListTodo,
    Calculator,
    Map,
    History,
    Wallet,
    BarChart3,
    PieChart,
    Receipt
} from 'lucide-react';

export default function RibbonMenu({ projectId }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('inicio');

    const handleNavigate = (path) => {
        navigate(`/proyecto/${projectId}${path}`);
    };

    const isActive = (path) => location.pathname.includes(path);

    const ToolButton = ({ icon: Icon, label, path, color = "text-slate-600" }) => (
        <button
            onClick={() => handleNavigate(path)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[70px] px-2 py-1.5 rounded-lg transition-all hover:bg-slate-100 group ${isActive(path) ? 'bg-blue-50 border border-blue-100' : ''}`}
        >
            <Icon className={`h-5 w-5 ${isActive(path) ? 'text-blue-600' : color} group-hover:scale-110 transition-transform`} />
            <span className={`text-[11px] font-medium leading-tight text-center ${isActive(path) ? 'text-blue-700' : 'text-slate-600'}`}>
                {label}
            </span>
        </button>
    );

    const Separator = () => <div className="w-px h-10 bg-slate-200 mx-1 self-center"></div>;

    return (
        <div className="bg-white border-b border-slate-200 shadow-sm sticky top-16 z-20">

            {/* TABS SUPERIORES */}
            <div className="flex px-4 bg-slate-50 border-b border-slate-200">
                {['inicio', 'configuracion', 'procesos', 'reportes'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${activeTab === tab
                            ? 'border-blue-600 text-blue-700 bg-white'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* TOOLBAR CONTENT (RIBBON BODY) */}
            <div className="h-20 px-4 flex items-center overflow-x-auto gap-2 py-1.5">

                {activeTab === 'inicio' && (
                    <div className="flex items-center gap-2 animate-fadeIn">
                        {(() => {
                            const isDashboard = location.pathname === `/proyecto/${projectId}` || location.pathname === `/proyecto/${projectId}/`;
                            return (
                                <button
                                    onClick={() => handleNavigate('')}
                                    className={`flex flex-col justify-center px-4 border-r border-slate-100 pr-6 mr-2 hover:bg-slate-50 transition-colors text-left ${isDashboard ? 'bg-blue-50 border-y border-l border-blue-100 rounded-l-lg' : ''}`}
                                >
                                    <h3 className="text-sm font-bold text-slate-800">Panel General</h3>
                                    <p className="text-xs text-slate-400">Resumen Ejecutivo</p>
                                </button>
                            );
                        })()}
                        <ToolButton icon={Users} label="Cuadrillas" path="/cuadrillas" color="text-blue-500" />
                        <ToolButton icon={ArrowRightSquare} label="Asignar" path="/tareas" color="text-slate-700" />
                        <Separator />
                        <ToolButton icon={Wallet} label="Gastos Cuadrilla" path="/gastos/cuadrillas" color="text-emerald-600" />
                    </div>
                )}

                {activeTab === 'configuracion' && (
                    <div className="flex items-center gap-2 animate-fadeIn">
                        <ToolButton icon={Users} label="Cuadrillas" path="/cuadrillas" color="text-blue-500" />
                        <ToolButton icon={ListTodo} label="Actividades" path="/actividades" color="text-red-500" />
                        <ToolButton icon={Calculator} label="Cubicaciones" path="/cubicaciones" color="text-purple-600" />
                        <ToolButton icon={Map} label="Zonas" path="/zonas" color="text-slate-500" />
                    </div>
                )}

                {activeTab === 'procesos' && (
                    <div className="flex items-center gap-2 animate-fadeIn">
                        <ToolButton icon={ArrowRightSquare} label="Asignar Tarea" path="/tareas" color="text-slate-800" />
                        <ToolButton icon={History} label="Historial" path="/tareas?view=historial" color="text-amber-500" />
                        <Separator />
                        <ToolButton icon={Wallet} label="Gastos Cuadrilla" path="/gastos/cuadrillas" color="text-emerald-500" />
                    </div>
                )}

                {activeTab === 'reportes' && (
                    <div className="flex items-center gap-2 animate-fadeIn">
                        <ToolButton icon={BarChart3} label="Producción" path="/reportes/produccion-actividad" color="text-indigo-500" />
                        <ToolButton icon={PieChart} label="Resultados" path="/reportes/resumen-subcontrato" color="text-violet-500" />
                        <ToolButton icon={Receipt} label="Est. Pagos" path="/reportes/estado-pagos" color="text-red-500" />
                    </div>
                )}

            </div>
        </div>
    );
}
