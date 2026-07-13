export default function ReportarPage() {
    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">Reportar identificador de riesgo</h1>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h2 className="font-semibold text-yellow-800 mb-2">Canales oficiales de denuncia</h2>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>📞 Línea 141 ICBF — Atención gratuita 24/7</li>
                    <li>🌐 CAI Virtual — <a href="https://www.policia.gov.co" className="underline">policia.gov.co</a></li>
                    <li>📱 Te Protejo — Línea de denuncia digital</li>
                </ul>
                <p className="text-xs text-yellow-600 mt-2">
                    Este formulario es un registro comunitario. Para denuncias oficiales, use los canales arriba.
                </p>
            </div>

            <form action="/api/reportes" method="POST" className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Identificador (número, nick o usuario)</label>
                    <input name="identificador" required minLength={3} maxLength={100}
                        className="w-full border rounded px-3 py-2" placeholder="+573001234567 o @usuario" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Plataforma</label>
                    <select name="plataforma" required className="w-full border rounded px-3 py-2">
                        <option value="">Seleccione...</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="facebook">Facebook</option>
                        <option value="discord">Discord</option>
                        <option value="roblox">Roblox</option>
                        <option value="minecraft">Minecraft</option>
                        <option value="telegram">Telegram</option>
                        <option value="snapchat">Snapchat</option>
                        <option value="otro">Otra</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Descripción de la situación</label>
                    <textarea name="texto" required minLength={20} maxLength={5000}
                        className="w-full border rounded px-3 py-2 h-32"
                        placeholder="Describa lo ocurrido con el mayor detalle posible (mínimo 20 caracteres)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Fecha del incidente</label>
                        <input name="fechaIncidente" type="datetime-local" required
                            className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Ciudad</label>
                        <input name="ciudad" required className="w-full border rounded px-3 py-2" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium">País</label>
                    <input name="pais" required defaultValue="Colombia"
                        className="w-full border rounded px-3 py-2" />
                </div>
                <button type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Enviar reporte
                </button>
            </form>
        </div>
    );
}