import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import RibbonMenu from '../components/RibbonMenu';

export default function ProjectLayout() {
    const { projectId } = useParams();

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-inter">
            {/* EL NAVBAR GLOBAL YA ESTÁ FUERA EN App.jsx, AQUÍ SOLO EL RIBBON */}

            {/* 1. RIBBON MENU PERSISTENTE */}
            <RibbonMenu projectId={projectId} />

            {/* 2. CONTENIDO DE LA PÁGINA ACTUAL */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
