'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Pencil, Trash2, ArrowLeft, X, AlertCircle, RotateCcw } from 'lucide-react';
import type { EquipoMercado, EquipoCategoria } from '@/lib/types/equipo';
import { CATEGORIA_LABELS } from '@/lib/types/equipo';

interface Props {
  initialEquipos: EquipoMercado[];
  total: number;
}

const EMPTY_FORM = {
  slug: '',
  nombre: '',
  descripcion: '',
  descripcion_corta: '',
  categoria: 'planta_lavado_oro' as EquipoCategoria,
  proveedor: '',
  precio_min_usd: '',
  precio_max_usd: '',
  moq: '1',
  unidad_moq: 'Pieza',
  capacidad: '',
  potencia: '',
  peso: '',
  dimensiones: '',
  imagen_url: '',
  destacado: false,
  orden: '0',
};

export function AdminEquiposClient({ initialEquipos, total: initialTotal }: Props) {
  const [equipos, setEquipos] = useState(initialEquipos);
  const [total, setTotal] = useState(initialTotal);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Separate channel for list-refresh failures — resetForm() clears `error`,
  // so a refresh problem after a successful save must not ride on it
  // (invariante PR #159 §13: nunca tragar errores en silencio en UI admin).
  const [listError, setListError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Row-level lock — disables action buttons while a request is in flight so a
  // double click can't fire two concurrent mutations (invariante PR #159 §12).
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const refreshList = async () => {
    try {
      const res = await fetch('/api/admin/equipos');
      if (!res.ok) {
        setListError(
          res.status === 401
            ? 'Tu sesión expiró — la operación pudo haberse guardado, pero la lista no se actualizó. Recargá la página.'
            : 'La operación se guardó, pero no se pudo actualizar la lista. Recargá la página.'
        );
        return;
      }
      const data = await res.json();
      setEquipos(data.equipos ?? []);
      setTotal(data.total ?? 0);
      setListError('');
    } catch (err) {
      console.error('[admin/equipos] refresh failed:', err);
      setListError('No se pudo actualizar la lista. Recargá la página.');
    }
  };

  const handleEdit = (equipo: EquipoMercado) => {
    setForm({
      slug: equipo.slug,
      nombre: equipo.nombre,
      descripcion: equipo.descripcion || '',
      descripcion_corta: equipo.descripcion_corta || '',
      categoria: equipo.categoria,
      proveedor: equipo.proveedor,
      precio_min_usd: equipo.precio_min_usd.toString(),
      precio_max_usd: equipo.precio_max_usd?.toString() || '',
      moq: equipo.moq.toString(),
      unidad_moq: equipo.unidad_moq,
      capacidad: equipo.capacidad || '',
      potencia: equipo.potencia || '',
      peso: equipo.peso || '',
      dimensiones: equipo.dimensiones || '',
      imagen_url: equipo.imagen_url,
      destacado: equipo.destacado,
      orden: equipo.orden.toString(),
    });
    setEditingId(equipo.id);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side guard: FormField has no required attr, and NaN would
    // serialize to JSON null and bounce off the server as a 400.
    const precioMinNum = Number.parseInt(form.precio_min_usd, 10);
    if (!Number.isInteger(precioMinNum) || precioMinNum <= 0) {
      setError('Precio mín USD debe ser un número entero mayor a 0.');
      return;
    }
    const precioMaxNum = form.precio_max_usd ? Number.parseInt(form.precio_max_usd, 10) : null;
    if (precioMaxNum !== null && (!Number.isInteger(precioMaxNum) || precioMaxNum < precioMinNum)) {
      setError('Precio máx USD debe ser un entero mayor o igual al precio mínimo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = editingId ? `/api/admin/equipos/${editingId}` : '/api/admin/equipos';
      const method = editingId ? 'PATCH' : 'POST';

      const body = {
        ...form,
        precio_min_usd: precioMinNum,
        // null (not undefined) so clearing the field actually persists —
        // JSON.stringify drops undefined and the PATCH whitelist never
        // sees the key, silently keeping the stale range.
        precio_max_usd: precioMaxNum,
        moq: Number.parseInt(form.moq, 10) || 1,
        orden: Number.parseInt(form.orden, 10) || 0,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar');
      }

      await refreshList();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este equipo? Dejará de mostrarse en el catálogo público. Podés reactivarlo después desde esta tabla.')) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/equipos/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setBusyId(null);
    }
  };

  // Counterpart of the soft-delete: without this, an accidentally deactivated
  // row was a dead-end (edit form never sends `activo`, and re-creating the
  // product 409s on the UNIQUE slug still owned by the inactive row).
  const handleReactivate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/equipos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al reactivar');
      }

      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reactivar');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-sm hover:underline"
            style={{ color: 'var(--slate)' }}
          >
            <ArrowLeft size={16} />
            Admin
          </Link>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--t1)' }}
          >
            Equipos Mercado
          </h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--moss)', color: '#fff' }}
        >
          <Plus size={16} />
          Nuevo equipo
        </button>
      </div>

      {/* Error banner (row-level actions) */}
      {error && !showForm && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
          style={{
            background: 'color-mix(in oklch, var(--red) 10%, white)',
            color: 'var(--red)',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* List-refresh failure — the mutation may have succeeded, only the
          re-fetch failed, so this must survive resetForm()'s error clear */}
      {listError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
          style={{
            background: 'color-mix(in oklch, var(--amber) 14%, white)',
            color: 'var(--amber)',
          }}
        >
          <AlertCircle size={16} />
          {listError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total equipos" value={total} />
        <StatCard label="Activos" value={equipos.filter((e) => e.activo).length} />
        <StatCard label="Destacados" value={equipos.filter((e) => e.destacado).length} />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Editar equipo' : 'Nuevo equipo'}
        >
          <div
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl p-6"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--t1)' }}>
                {editingId ? 'Editar equipo' : 'Nuevo equipo'}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="Cerrar formulario">
                <X size={20} style={{ color: 'var(--t2)' }} />
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{
                  background: 'color-mix(in oklch, var(--red) 10%, white)',
                  color: 'var(--red)',
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Slug*"
                  value={form.slug}
                  onChange={(v) => setForm({ ...form, slug: v })}
                  placeholder="planta-lavado-oro-50tph"
                />
                <FormField
                  label="Nombre*"
                  value={form.nombre}
                  onChange={(v) => setForm({ ...form, nombre: v })}
                  placeholder="Planta de Lavado de Oro 50TPH"
                />
              </div>

              <FormField
                label="Descripción corta"
                value={form.descripcion_corta}
                onChange={(v) => setForm({ ...form, descripcion_corta: v })}
                placeholder="Resumen de 1-2 líneas"
              />
              <FormField
                label="Descripción completa"
                value={form.descripcion}
                onChange={(v) => setForm({ ...form, descripcion: v })}
                placeholder="Descripción detallada..."
                isTextarea
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--t1)' }}
                    htmlFor="equipo-categoria"
                  >
                    Categoría*
                  </label>
                  <select
                    id="equipo-categoria"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value as EquipoCategoria })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg-soft)',
                      color: 'var(--t1)',
                    }}
                  >
                    {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <FormField
                  label="Proveedor*"
                  value={form.proveedor}
                  onChange={(v) => setForm({ ...form, proveedor: v })}
                  placeholder="JXSC Mineral"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  label="Precio mín USD*"
                  value={form.precio_min_usd}
                  onChange={(v) => setForm({ ...form, precio_min_usd: v })}
                  placeholder="5000"
                  type="number"
                />
                <FormField
                  label="Precio máx USD"
                  value={form.precio_max_usd}
                  onChange={(v) => setForm({ ...form, precio_max_usd: v })}
                  placeholder="10000"
                  type="number"
                />
                <FormField
                  label="Orden"
                  value={form.orden}
                  onChange={(v) => setForm({ ...form, orden: v })}
                  placeholder="0"
                  type="number"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  label="MOQ"
                  value={form.moq}
                  onChange={(v) => setForm({ ...form, moq: v })}
                  placeholder="1"
                  type="number"
                />
                <FormField
                  label="Unidad MOQ"
                  value={form.unidad_moq}
                  onChange={(v) => setForm({ ...form, unidad_moq: v })}
                  placeholder="Pieza"
                />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.destacado}
                      onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
                      className="w-4 h-4 accent-[var(--moss)]"
                    />
                    <span className="text-sm" style={{ color: 'var(--t2)' }}>
                      Destacado
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Capacidad"
                  value={form.capacidad}
                  onChange={(v) => setForm({ ...form, capacidad: v })}
                  placeholder="50-100 toneladas/hora"
                />
                <FormField
                  label="Potencia"
                  value={form.potencia}
                  onChange={(v) => setForm({ ...form, potencia: v })}
                  placeholder="15 HP"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Peso"
                  value={form.peso}
                  onChange={(v) => setForm({ ...form, peso: v })}
                  placeholder="3,500 kg"
                />
                <FormField
                  label="Dimensiones"
                  value={form.dimensiones}
                  onChange={(v) => setForm({ ...form, dimensiones: v })}
                  placeholder="LxAxH en metros"
                />
              </div>

              <FormField
                label="URL Imagen principal*"
                value={form.imagen_url}
                onChange={(v) => setForm({ ...form, imagen_url: v })}
                placeholder="https://..."
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--ink)', color: '#fff' }}
                >
                  {isSubmitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium"
                  style={{ border: '1px solid var(--border)', color: 'var(--t2)' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--ink)' }}>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fff' }}>
                Equipo
              </th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fff' }}>
                Categoría
              </th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fff' }}>
                Precio
              </th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fff' }}>
                Estado
              </th>
              <th scope="col" className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#fff' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {equipos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--slate)' }}>
                  Sin equipos registrados. Aplica la migración 027 y ejecuta{' '}
                  <code style={{ fontFamily: 'var(--font-jetbrains)' }}>node scripts/seed-equipos.mjs</code>{' '}
                  o crea el primero con «Nuevo equipo».
                </td>
              </tr>
            )}
            {equipos.map((equipo) => (
              <tr
                key={equipo.id}
                className="border-b last:border-0 hover:bg-[var(--bg-soft)] transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                      style={{ background: 'var(--bg-soft)' }}
                    >
                      <Image
                        src={equipo.imagen_url}
                        alt={equipo.nombre}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>
                        {equipo.nombre}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--slate)' }}>
                        {equipo.proveedor}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{ background: 'var(--bg-soft)', color: 'var(--t2)' }}
                  >
                    {CATEGORIA_LABELS[equipo.categoria]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--earth)' }}>
                  US${equipo.precio_min_usd.toLocaleString()}
                  {equipo.precio_max_usd && ` - ${equipo.precio_max_usd.toLocaleString()}`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {equipo.activo ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: 'color-mix(in oklch, var(--green) 14%, white)',
                          color: 'var(--green)',
                        }}
                      >
                        Activo
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: 'color-mix(in oklch, var(--red) 14%, white)',
                          color: 'var(--red)',
                        }}
                      >
                        Inactivo
                      </span>
                    )}
                    {equipo.destacado && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: 'color-mix(in oklch, var(--amber) 14%, white)',
                          color: 'var(--amber)',
                        }}
                      >
                        Destacado
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(equipo)}
                      disabled={busyId === equipo.id}
                      aria-label={`Editar ${equipo.nombre}`}
                      className="p-1.5 rounded hover:bg-[var(--bg-soft)] transition-colors disabled:opacity-50"
                      style={{ color: 'var(--slate)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    {equipo.activo ? (
                      <button
                        onClick={() => handleDelete(equipo.id)}
                        disabled={busyId === equipo.id}
                        aria-label={`Desactivar ${equipo.nombre}`}
                        className="p-1.5 rounded hover:bg-[var(--bg-soft)] transition-colors disabled:opacity-50"
                        style={{ color: 'var(--red)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(equipo.id)}
                        disabled={busyId === equipo.id}
                        aria-label={`Reactivar ${equipo.nombre}`}
                        title="Reactivar"
                        className="p-1.5 rounded hover:bg-[var(--bg-soft)] transition-colors disabled:opacity-50"
                        style={{ color: 'var(--green)' }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== Sub-components ====================

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
    >
      <p
        className="text-2xl font-bold"
        style={{ fontFamily: 'var(--font-playfair)', color: 'var(--earth)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--slate)' }}>
        {label}
      </p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  isTextarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  isTextarea?: boolean;
}) {
  const inputClasses =
    'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--moss)]/20';
  const inputStyles = {
    border: '1px solid var(--border)',
    background: 'var(--bg-soft)',
    color: 'var(--t1)',
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t1)' }}>
        {label}
        {isTextarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={`${inputClasses} mt-1 font-normal`}
            style={inputStyles}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputClasses} mt-1 font-normal`}
            style={inputStyles}
          />
        )}
      </label>
    </div>
  );
}
