import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Categoria = { id: number; name: string; image_url?: string | null; description?: string | null };

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({ name: '', image_url: '', description: '' });
  const canCreate = Boolean(form.name && form.image_url);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cats = await Api.categorias();
      setCategorias(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando categorías');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir la imagen';
      setUploadError(msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setError(null);
    try {
      await Api.crearCategoria({
        name: form.name,
        image_url: form.image_url,
        description: form.description || undefined,
      });
      setForm({ name: '', image_url: '', description: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la categoría');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Categorías</h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
          {(error || uploadError) && (
            <div className="md:col-span-6 space-y-1">
              {error && <Alert kind="error" message={error} />}
              {uploadError && <Alert kind="error" message={uploadError} />}
            </div>
          )}
          <input className="input-modern text-sm" placeholder="Nombre" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
          <input className="input-modern text-sm md:col-span-3" placeholder="Descripción (opcional)" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} />
          <div className="md:col-span-2 flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              className="input-modern text-sm"
              onChange={handleImageFileChange}
            />
            <input
              className="input-modern text-xs"
              placeholder="URL imagen (se completa al subir)"
              value={form.image_url}
              onChange={(e)=>setForm({...form, image_url: e.target.value})}
            />
            {uploadingImage && (
              <span className="text-[11px] text-slate-400">Subiendo imagen a Cloudinary...</span>
            )}
          </div>
          <Button disabled={!canCreate} className="md:col-span-6">Crear categoría</Button>
        </form>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Imagen</th>
                  <th className="py-2">Descripción</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {categorias.map((c) => (
                  <tr key={c.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.name} className="h-8 w-8 object-cover rounded" />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2">{c.description || '-'}</td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                        onClick={async () => {
                          const name = window.prompt('Nombre de la categoría', c.name) ?? c.name;
                          const description = window.prompt('Descripción (opcional)', c.description || '') ?? (c.description || '');
                          const image_url = window.prompt('URL de imagen', c.image_url || '') ?? (c.image_url || '');
                          try {
                            await Api.actualizarCategoria(c.id, { name, description, image_url });
                            await load();
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo actualizar la categoría');
                          }
                        }}
                      >Editar</button>
                      <button
                        className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                        onClick={async () => {
                          if (!window.confirm(`Eliminar categoría ${c.name}? (también desactiva productos)`)) return;
                          try {
                            await Api.eliminarCategoria(c.id);
                            await load();
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo eliminar la categoría');
                          }
                        }}
                      >Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}





