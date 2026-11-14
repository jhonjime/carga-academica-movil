<script>
    let {
        abierto = $bindable(false),
        titulo = 'Formulario',
        subtitulo = '',
        textoGuardar = 'Guardar',
        textoCancelar = 'Cancelar',
        cargando = false,
        onGuardar,
        onCerrar,
        children
    } = $props();

    function cerrar() {
        if (cargando) return;
        abierto = false;
        onCerrar?.();
    }
</script>

{#if abierto}
    <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 rounded-4 shadow-lg">
                <div class="modal-header border-bottom px-4 px-md-5 py-4">
                    <div class="d-flex align-items-center gap-3">
                        
                        <div>
                            <h3 id="titulo-modal" class="modal-title fw-bold mb-1">{titulo}</h3>
                            {#if subtitulo}<p class="text-muted mb-0">{subtitulo}</p>{/if}
                        </div>
                    </div>
                    <button type="button" class="btn-close ms-3" aria-label="Cerrar" onclick={cerrar} disabled={cargando}></button>
                </div>

                <form
                    onsubmit={(e) => {
                        e.preventDefault();
                        if (!cargando) onGuardar?.(e);
                    }}
                >
                    <div class="modal-body px-4 px-md-5 py-4">
                        {@render children?.()}
                    </div>

                    <div class="modal-footer border-top px-4 px-md-5 py-4 gap-2">
                        <button type="button" class="btn btn-light border px-4 py-2" onclick={cerrar} disabled={cargando}>
                            <i class="bi bi-x-lg me-2"></i>{textoCancelar}
                        </button>
                        <button type="submit" class="btn btn-primary boton-guardar px-4 py-2 fw-semibold" disabled={cargando}>
                            {#if cargando}
                                <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando...
                            {:else}
                                <i class="bi bi-check-lg me-2"></i>{textoGuardar}
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>
{/if}

<style>
    .modal-dialog {
        width: calc(100% - 2rem);
        max-width: 1100px;
        max-height: 90vh;
    }

    .modal-content { max-height: 90vh; overflow: hidden; }
    .modal-body { overflow-y: auto; }
    .modal-title { color: #0f3460; font-size: 1.5rem; }



    .boton-guardar { background-color: #0f3460; border-color: #0f3460; }
    .boton-guardar:hover { background-color: #0b284b; border-color: #0b284b; }

    /* Celular: el formulario se abre como hoja inferior (bottom sheet) */
    @media (max-width: 575.98px) {
        .modal-dialog {
            width: 100%;
            max-width: none;
            margin: 0;
            min-height: 100%;
            align-items: flex-end;
            max-height: none;
        }
        .modal-content {
            max-height: calc(94dvh - var(--sat));
            border-radius: 22px 22px 0 0 !important;
            animation: subir 0.25s ease-out;
        }
        .modal-header { padding: 0.9rem 1rem 0.75rem !important; position: relative; }
        .modal-header::before {
            content: '';
            position: absolute;
            top: 6px;
            left: 50%;
            width: 40px;
            height: 4px;
            margin-left: -20px;
            border-radius: 4px;
            background: #d5dde8;
        }
        .modal-body { padding: 1rem !important; }
        .modal-footer {
            padding: 0.75rem 1rem calc(0.75rem + var(--sab)) !important;
            flex-wrap: nowrap;
        }
        .modal-footer .btn { flex: 1; min-height: 46px; border-radius: 12px; }
        .modal-title { font-size: 1.15rem; }
    }

    @keyframes subir {
        from { transform: translateY(40px); opacity: 0.6; }
        to { transform: none; opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
        .modal-content { animation: none; }
    }
</style>