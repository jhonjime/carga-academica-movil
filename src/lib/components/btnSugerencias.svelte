
<script>
    import Formulariosugerencia from './Formulariosugerencia.svelte';

    let abierto = $state(false);
    let enviado = $state(false);

    function abrirFormulario() {
        abierto = true;
        enviado = false;
    }

    function cerrarFormulario() {
        abierto = false;
    }

    function confirmarEnvio() {
        abierto = false;
        enviado = true;
    }
</script>

{#if !abierto}
    <button
        type="button"
        class="boton-sugerencias"
        onclick={abrirFormulario}
        aria-label="Abrir formulario de sugerencias"
        title="Enviar una sugerencia"
    >
        <i class="bi bi-chat-square-text"></i>
        <span> Sugerencias </span>
    </button>
{/if}

{#if abierto}
    <Formulariosugerencia
        alCerrar={cerrarFormulario}
        alEnviar={confirmarEnvio}
    />
{/if}

{#if enviado}
    <div class="aviso-exito" role="status">
        <i class="bi bi-check-circle-fill"></i>
        <div>
            <strong>¡Gracias por tu sugerencia!</strong>
            <p>Tu opinión nos ayuda a mejorar.</p>
        </div>
        <button
            type="button"
            class="cerrar-aviso"
            onclick={() => (enviado = false)}
            aria-label="Cerrar aviso"
        >
            <i class="bi bi-x-lg"></i>
        </button>
    </div>
{/if}

<style>
    .boton-sugerencias {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1050;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 13px 18px;
        border: none;
        border-radius: 50px;
        background: #0f3460;
        color: white;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 5px 18px rgba(15, 52, 96, 0.25);
        cursor: pointer;
        transition: transform 0.2s, background 0.2s;
    }

    .boton-sugerencias:hover {
        background: #16477f;
        transform: translateY(-2px);
    }

    .boton-sugerencias i {
        font-size: 18px;
    }

    .aviso-exito {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1060;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: min(360px, calc(100vw - 32px));
        padding: 18px;
        border: 1px solid #cce8d5;
        border-radius: 14px;
        background: white;
        color: #212529;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    }

    .aviso-exito > i {
        color: #198754;
        font-size: 24px;
    }

    .aviso-exito p {
        margin: 5px 0 0;
        color: #6c757d;
        font-size: 13px;
    }

    .cerrar-aviso {
        margin-left: auto;
        border: none;
        background: transparent;
        color: #6c757d;
        cursor: pointer;
    }

    /* Celular: botón flotante compacto, por encima de la barra inferior */
    @media (max-width: 991.98px) {
        .boton-sugerencias {
            right: 16px;
            bottom: calc(78px + var(--sab));
            width: 52px;
            height: 52px;
            padding: 0;
            justify-content: center;
            border-radius: 16px;
            background: linear-gradient(135deg, #0f3460 0%, #1d5aa8 100%);
            box-shadow: 0 8px 22px rgba(15, 52, 96, 0.35);
        }

        .boton-sugerencias span {
            display: none;
        }

        .boton-sugerencias i {
            font-size: 20px;
        }

        .aviso-exito {
            right: 12px;
            left: 12px;
            width: auto;
            bottom: calc(78px + var(--sab));
        }

        :global(html.teclado-abierto) .boton-sugerencias {
            display: none;
        }
    }
</style>
