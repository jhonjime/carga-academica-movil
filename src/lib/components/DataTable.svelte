
<script>
    import { onMount } from 'svelte';

    let {
        columns = [],
        rows = [],
        loading = false,
        title = 'Listado de registros',
        emptyMessage = 'No hay registros disponibles.',
        pageSize = 10,
        showPagination = true,
        onEdit,
        onDelete
    } = $props();

    let el;
    let dt = $state.raw(null);
    let error = $state('');
    let busqueda = $state('');

    const ESTADOS = Object.fromEntries([
        ...['true', '1', 'a', 'activo', 'activa', 'active', 'sí', 'si', 'habilitado', 'habilitada']
            .map((k) => [k, 'Activo']),
        ...['false', '0', 'i', 'inactivo', 'inactiva', 'inactive', 'no', 'deshabilitado', 'deshabilitada']
            .map((k) => [k, 'Inactivo'])
    ]);

    const CLASES = {
        Activo: 'bg-success-subtle text-success',
        Inactivo: 'bg-danger-subtle text-danger'
    };

    const ACCIONES = [
        ['editar', 'Editar', 'boton-editar', 'bi-pencil-square'],
        ['eliminar', 'Eliminar', 'boton-eliminar', 'bi-trash']
    ];

    const ESC = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    const esc = (v) =>
        String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

    const estadoDe = (v) => {
        const e = String(v ?? '').trim().toLocaleLowerCase('es');

        return ESTADOS[e] ??
            (e ? e[0].toLocaleUpperCase('es') + e.slice(1) : '—');
    };

    const esperarDataTable = () =>
        new Promise((resolve, reject) => {
            let intentos = 0;

            const t = setInterval(() => {
                if (window.DataTable) {
                    clearInterval(t);
                    resolve(window.DataTable);
                    return;
                }

                if (++intentos > 100) {
                    clearInterval(t);
                    reject(
                        new Error(
                            'DataTables no se cargó. Revisa los scripts de app.html.'
                        )
                    );
                }
            }, 50);
        });

    function crearColumnas(handlers) {
        const cols = columns.map((c) => ({
            data: c.key,
            title: c.label,
            orderable: c.sortable !== false,
            className: 'text-center px-3 py-3',
            // Etiqueta usada por la vista de tarjetas en el celular.
            createdCell: (td) => td.setAttribute('data-label', c.label),

            render: (v, tipo) => {
                if (c.type === 'status') {
                    const estado = estadoDe(v);

                    return tipo === 'display'
                        ? `<span class="badge rounded-pill ${CLASES[estado] ?? 'bg-light text-dark border'}">${esc(estado)}</span>`
                        : estado;
                }

                return tipo === 'display'
                    ? `<span class="${esc(c.cellClass ?? '')}">${esc(v) || '—'}</span>`
                    : (v ?? '');
            }
        }));

        const acciones = ACCIONES.filter(
            ([clave]) => typeof handlers[clave] === 'function'
        );

        if (acciones.length) {
            cols.push({
                data: null,
                title: 'Acciones',
                orderable: false,
                searchable: false,
                className: 'text-center px-3 py-3 celda-acciones',

                render: () =>
                    `<div class="d-flex justify-content-center gap-2">
                        ${acciones.map(([clave, texto, clase, icono]) =>
                            `<button
                                type="button"
                                class="btn btn-sm boton-accion ${clase}"
                                data-accion="${clave}"
                                title="${texto}"
                                aria-label="${texto} registro"
                            >
                                <i class="bi ${icono} me-1"></i>${texto}
                            </button>`
                        ).join('')}
                    </div>`
            });
        }

        return cols;
    }

    onMount(() => {
        let vivo = true;

        const handlers = {
            editar: onEdit,
            eliminar: onDelete
        };

        const clic = (e) => {
            const boton = e.target.closest?.('button[data-accion]');
            if (!boton || !dt) return;

            const fila = dt.row(boton.closest('tr')).data();

            if (fila) {
                handlers[boton.dataset.accion]?.(fila);
            }
        };

        el.addEventListener('click', clic);

        esperarDataTable()
            .then((DataTable) => {
                if (!vivo) return;

                dt = new DataTable(el, {
                    data: [],
                    columns: crearColumnas(handlers),
                    pageLength: Number(pageSize) || 10,
                    lengthMenu: [5, 10, 25, 50],
                    paging: showPagination,

                    // El buscador personalizado se encarga de filtrar.
                    searching: true,
                    processing: false,

                    order: [],
                    autoWidth: false,

                    layout: showPagination
                        ? {
                            topStart: 'pageLength',
                            topEnd: null,
                            bottomStart: 'info',
                            bottomEnd: 'paging'
                        }
                        : {
                            topStart: null,
                            topEnd: null,
                            bottomStart: null,
                            bottomEnd: null
                        },

                    language: {
                        emptyTable: emptyMessage,
                        zeroRecords: 'No se encontraron registros',
                        processing: 'Cargando registros...',
                        lengthMenu: 'Mostrar _MENU_ por página',
                        info: 'Mostrando _START_–_END_ de _TOTAL_',
                        infoEmpty: 'Mostrando 0–0 de 0',
                        infoFiltered: '(filtrado de _MAX_ registros)',
                        paginate: {
                            previous: '‹',
                            next: '›'
                        }
                    }
                });

                dt.search(busqueda).draw();
            })
            .catch((e) => {
                console.error(e);
                error = e.message;
            });

        return () => {
            vivo = false;
            el?.removeEventListener('click', clic);
            dt?.destroy();
            dt = null;
        };
    });

    $effect(() => {
        if (dt) {
            dt.clear()
                .rows.add($state.snapshot(rows))
                .draw(false);
        }
    });

    $effect(() => {
        if (dt) {
            dt.search(busqueda).draw();
        }
    });
</script>

<div class="card border-0 shadow-sm rounded-4 overflow-hidden">
    <div class="card-header bg-white border-0 p-3 p-md-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
                <h5 class="fw-bold mb-1">{title}</h5>

                <small class="text-muted">
                    {rows.length}
                    {rows.length === 1
                        ? 'registro encontrado'
                        : 'registros encontrados'}
                </small>
            </div>

            <div class="buscador-container">
                <div class="input-group">
                    <span class="input-group-text bg-white border-end-0">
                        <i class="bi bi-search text-muted"></i>
                    </span>

                    <input
                        type="search"
                        class="form-control border-start-0 buscador-input"
                        placeholder="Buscar registros..."
                        aria-label="Buscar en la tabla"
                        bind:value={busqueda}
                    />

                    {#if busqueda}
                        <button
                            type="button"
                            class="btn btn-outline-secondary"
                            aria-label="Limpiar búsqueda"
                            onclick={() => busqueda = ''}
                        >
                            <i class="bi bi-x-lg"></i>
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <div class="card-body">
        {#if error}
            <div class="alert alert-warning mb-3" role="alert">
                {error}
            </div>
        {/if}

        {#if loading}
            <div class="text-center py-3 text-muted">
                <span
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                ></span>
                Cargando registros...
            </div>
        {/if}

        <div class="table-responsive">
            <table
                bind:this={el}
                class="table table-hover align-middle text-center mb-0 w-100 tabla-tarjetas"
            ></table>
        </div>
    </div>
</div>

<style>
    .buscador-container {
        width: min(100%, 340px);
    }

    :global(.buscador-input:focus) {
        border-color: #86b7fe;
        box-shadow: 0 0 0 0.2rem rgb(15 52 96 / 10%);
    }

    :global(.input-group-text) {
        border-radius: 10px 0 0 10px;
    }

    :global(.buscador-input) {
        border-radius: 0 10px 10px 0;
    }

    :global(.boton-accion) {
        background-color: #fff;
        font-weight: 500;
        border: 1px solid;
        border-radius: 8px;
        padding: 6px 12px;
        white-space: nowrap;
        transition: all 0.2s ease;
    }

    :global(.boton-editar) {
        color: #0f3460;
        border-color: #b8d4f0;
    }

    :global(.boton-editar:hover),
    :global(.boton-editar:focus-visible) {
        background-color: #e3f2fd;
        color: #0f3460;
        border-color: #90caf9;
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgb(15 52 96 / 12%);
    }

    :global(.boton-eliminar) {
        color: #dc3545;
        border-color: #f1b7bd;
    }

    :global(.boton-eliminar:hover),
    :global(.boton-eliminar:focus-visible) {
        background-color: #fff0f1;
        color: #bb2d3b;
        border-color: #f1aeb5;
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgb(220 53 69 / 12%);
    }

    :global(.boton-accion:active) {
        transform: translateY(0) scale(0.97);
        box-shadow: none;
    }

    @media (max-width: 576px) {
        .buscador-container {
            width: 100%;
        }
    }

    /* ── Celular: cada fila se muestra como una tarjeta ─────────────── */
    @media (max-width: 767.98px) {
        .card-header {
            padding: 1rem 1rem 0.5rem !important;
        }

        .card-body {
            padding: 0.5rem 0.75rem 1rem;
        }

        .table-responsive {
            overflow: visible;
        }

        :global(table.tabla-tarjetas) {
            border-collapse: separate;
            border-spacing: 0;
        }

        :global(table.tabla-tarjetas thead) {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
        }

        :global(table.tabla-tarjetas tbody tr) {
            display: block;
            margin-bottom: 0.75rem;
            padding: 0.4rem 0.9rem;
            border: 1px solid #e3eaf3;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 4px 14px rgba(15, 52, 96, 0.06);
        }

        :global(table.tabla-tarjetas tbody td) {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.55rem 0 !important;
            border: 0;
            border-bottom: 1px dashed #edf1f6;
            text-align: right !important;
            background: transparent !important;
            box-shadow: none !important;
            white-space: pre-line;
            word-break: break-word;
        }

        :global(table.tabla-tarjetas tbody td:last-child) {
            border-bottom: 0;
        }

        :global(table.tabla-tarjetas tbody td[data-label])::before {
            content: attr(data-label);
            flex-shrink: 0;
            max-width: 45%;
            text-align: left;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #8a97aa;
        }

        /* Primera columna como título de la tarjeta */
        :global(table.tabla-tarjetas tbody td:first-child) {
            font-weight: 700;
            color: #12233d;
            font-size: 0.95rem;
        }

        /* Botones de acción a todo el ancho */
        :global(table.tabla-tarjetas tbody td.celda-acciones) {
            padding-top: 0.75rem !important;
        }

        :global(table.tabla-tarjetas tbody td.celda-acciones > div) {
            width: 100%;
        }

        :global(table.tabla-tarjetas tbody td.celda-acciones .boton-accion) {
            flex: 1;
            padding: 9px 10px !important;
        }

        /* Fila de "sin registros" */
        :global(table.tabla-tarjetas tbody td.dt-empty) {
            justify-content: center;
            text-align: center !important;
            color: #6b7a90;
            font-weight: 500;
        }

        :global(table.tabla-tarjetas tbody tr:has(td.dt-empty)) {
            box-shadow: none;
            border-style: dashed;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        :global(.boton-accion) {
            transition: none;
        }
    }
</style>
