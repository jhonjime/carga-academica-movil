<script>
    let { alCerrar, alEnviar } = $props();

    let tipo = $state('Sugerencia');
    let modulo = $state('');
    let mensaje = $state('');
    let anonimo = $state(false);
    let error = $state('');

    const modulos = [
        'Inicio',
        'Usuarios',
        'Docentes',
        'Asignaturas',
        'Carga docente',
        'Evaluación docente',
        'Otro'
    ];

    function enviarFormulario(evento) {
        evento.preventDefault();

        if (!mensaje.trim()) {
            error = 'Escribe tu sugerencia antes de continuar.';
            return;
        }

        if (mensaje.trim().length < 5) {
            error = 'La sugerencia debe tener al menos 5 caracteres.';
            return;
        }

        error = '';
        alEnviar();
    }
</script>

<div 
    class="fondo-modal" 
    role="presentation" 
    onclick={(evento) => {
        if (evento.target === evento.currentTarget) {
            alCerrar();
        }
    }}
>
    <!-- Cambiado de <section> a <div> para cumplir con las reglas de accesibilidad -->
    <div
        class="panel-sugerencias"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-sugerencias"
    >
        <header class="encabezado-formulario">
            <div class="icono-encabezado">
                <i class="bi bi-chat-square-text"></i>
            </div>

            <div class="texto-encabezado">
                <h2 id="titulo-sugerencias">Tu opinión importa</h2>
                <p>Ayúdanos a mejorar la plataforma.</p>
            </div>

            <button
                type="button"
                class="boton-cerrar"
                data-cerrar-con-atras
                onclick={alCerrar}
                aria-label="Cerrar formulario"
            >
                <i class="bi bi-x-lg"></i>
            </button>
        </header>

        <form onsubmit={enviarFormulario}>
            <div class="cuerpo-formulario">
                <div class="campo">
                    <label for="tipo-sugerencia">Tipo de comentario</label>
                    <select id="tipo-sugerencia" bind:value={tipo}>
                        <option value="Sugerencia">Sugerencia</option>
                        <option value="Problema">Reportar un problema</option>
                        <option value="Mejora">Proponer una mejora</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>

                <div class="campo">
                    <label for="modulo-sugerencia">
                        Sección relacionada
                        <span class="opcional">(opcional)</span>
                    </label>

                    <select id="modulo-sugerencia" bind:value={modulo}>
                        <option value="">Selecciona una sección</option>
                        {#each modulos as nombre}
                            <option value={nombre}>{nombre}</option>
                        {/each}
                    </select>
                </div>

                <div class="campo">
                    <label for="mensaje-sugerencia">Tu comentario</label>
                    <textarea
                        id="mensaje-sugerencia"
                        bind:value={mensaje}
                        placeholder="Cuéntanos qué podríamos mejorar..."
                        rows="4"
                        maxlength="1000"
                        required
                    ></textarea>

                    <div class="contador">
                        {mensaje.length}/1000 caracteres
                    </div>
                </div>

                <label class="opcion-anonima">
                    <input type="checkbox" bind:checked={anonimo} />
                    <span>
                        <strong>Enviar de forma anónima</strong>
                        <small>No incluir mi identidad en el comentario.</small>
                    </span>
                </label>

                {#if error}
                    <div class="mensaje-error" role="alert">
                        <i class="bi bi-exclamation-circle"></i>
                        {error}
                    </div>
                {/if}
            </div>

            <footer class="acciones-formulario">
                <button
                    type="button"
                    class="boton-secundario"
                    onclick={alCerrar}
                >
                    Cancelar
                </button>

                <button type="submit" class="boton-enviar">
                    <i class="bi bi-send"></i>
                    Enviar sugerencia
                </button>
            </footer>
        </form>
    </div>
</div>

<style>
    .fondo-modal {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.70);
        backdrop-filter: blur(6px);
    }

    .panel-sugerencias {
        width: 100%;
        max-width: 480px;
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        border-radius: 16px;
        background: #fff;
        color: #212529;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .encabezado-formulario {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 22px 22px 18px;
        border-bottom: 1px solid #edf0f3;
    }

    .icono-encabezado {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: #eaf1f9;
        color: #0f3460;
        font-size: 21px;
    }

    .texto-encabezado {
        flex: 1;
    }

    .texto-encabezado h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
    }

    .texto-encabezado p {
        margin: 4px 0 0;
        color: #6c757d;
        font-size: 13px;
    }

    .boton-cerrar {
        align-self: flex-start;
        padding: 5px;
        border: none;
        background: transparent;
        color: #6c757d;
        cursor: pointer;
    }

    .cuerpo-formulario {
        display: grid;
        gap: 17px;
        padding: 22px;
    }

    .campo {
        display: grid;
        gap: 7px;
    }

    .campo label {
        font-size: 13px;
        font-weight: 600;
    }

    .campo select,
    .campo textarea {
        width: 100%;
        padding: 11px 12px;
        border: 1px solid #dce1e7;
        border-radius: 9px;
        outline: none;
        background: #fff;
        color: #212529;
        font: inherit;
        font-size: 14px;
        box-sizing: border-box;
    }

    .campo select:focus,
    .campo textarea:focus {
        border-color: #0f3460;
        box-shadow: 0 0 0 3px rgba(15, 52, 96, 0.1);
    }

    .campo textarea {
        resize: vertical;
        min-height: 100px;
    }

    .opcional {
        color: #6c757d;
        font-weight: 400;
    }

    .contador {
        color: #6c757d;
        font-size: 12px;
        text-align: right;
    }

    .opcion-anonima {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
    }

    .opcion-anonima input {
        margin-top: 4px;
        accent-color: #0f3460;
    }

    .opcion-anonima span {
        display: grid;
        gap: 3px;
    }

    .opcion-anonima strong {
        font-size: 13px;
    }

    .opcion-anonima small {
        color: #6c757d;
        font-size: 12px;
    }

    .mensaje-error {
        display: flex;
        gap: 8px;
        align-items: center;
        color: #b02a37;
        font-size: 13px;
    }

    .acciones-formulario {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
        border-top: 1px solid #edf0f3;
    }

    .boton-secundario,
    .boton-enviar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 15px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }

    .boton-secundario {
        border: 1px solid #dce1e7;
        background: #fff;
        color: #495057;
    }

    .boton-enviar {
        border: 1px solid #0f3460;
        background: #0f3460;
        color: #fff;
    }

    .boton-enviar:hover {
        background: #16477f;
    }

    @media (max-width: 480px) {
        .encabezado-formulario,
        .cuerpo-formulario {
            padding: 17px;
        }

        .acciones-formulario {
            padding: 14px 17px 17px;
        }

        .acciones-formulario button {
            flex: 1;
        }
    }
</style>