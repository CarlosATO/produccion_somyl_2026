// Leer configuración desde .env
const BASE_URL = import.meta.env.VITE_LOGISTICA_URL;
const API_KEY = import.meta.env.VITE_LOGISTICA_KEY;

if (!BASE_URL || !API_KEY) {
    console.error("🚨 Faltan las credenciales de LOGÍSTICA en el archivo .env");
}

export const logisticaService = {
    // Recibimos el proyectoId como segundo argumento
    async getEntregasProveedor(proveedorId, proyectoId) {
        if (!proveedorId) return [];

        console.log(`📡 Consultando Logística -> Prov: ${proveedorId} | Proy: ${proyectoId}`);

        try {
            // 1. CONSTRUCCIÓN DE LA CONSULTA
            // Filtros base: Solo guías de subcontrato y de este proveedor
            let queryParams = `select=id&is_subcontract=eq.true&provider_id=eq.${proveedorId}`;
            
            // --- FILTRO CLAVE: PROYECTO ---
            // Usamos la columna 'project_id' que confirmaste en la tabla
            if (proyectoId) {
                queryParams += `&project_id=eq.${proyectoId}`;
            }

            const urlDocs = `${BASE_URL}/rest/v1/logis_outbound_documents?${queryParams}`;
            
            const responseDocs = await fetch(urlDocs, {
                method: 'GET',
                headers: {
                    'apikey': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!responseDocs.ok) {
                const errorData = await responseDocs.json();
                console.error("❌ Error API Docs:", errorData);
                throw new Error(errorData.message || "Error al conectar con Logística");
            }

            const docs = await responseDocs.json();

            // Si no hay documentos para ESTE proyecto, retornamos vacío
            if (!docs || docs.length === 0) {
                return [];
            }

            // 2. BUSCAR LOS ITEMS (MATERIALES) DE ESAS GUÍAS
            const docIds = docs.map(d => d.id).join(',');
            
            const urlItems = `${BASE_URL}/rest/v1/logis_outbound_items?select=quantity,product:products(code,name,unit)&outbound_document_id=in.(${docIds})`;

            const responseItems = await fetch(urlItems, {
                method: 'GET',
                headers: {
                    'apikey': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!responseItems.ok) {
                console.error("❌ Error API Items");
                return [];
            }

            const items = await responseItems.json();

            // 3. LIMPIEZA DE DATOS
            const resultado = items.map(i => ({
                codigo: i.product?.code,
                nombre: i.product?.name,
                unidad: i.product?.unit || 'UN',
                cantidad: Number(i.quantity)
            }));

            return resultado;

        } catch (error) {
            console.error("🔥 Error Conexión Logística:", error);
            // En caso de error de red, devolvemos vacío para no romper la app
            return [];
        }
    }
};

export const supabaseLogistica = {};