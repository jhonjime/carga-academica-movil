<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Imagen from '$lib/components/Imagen.svelte';

    // Punto de entrada de la app: con sesión va al inicio; sin sesión, al login.
    onMount(() => {
        goto(sessionStorage.getItem('usuario') ? '/inicio' : '/login', { replaceState: true });
    });
</script>

<div class="arranque">
    <Imagen ancho="auto" alto="88px" alt="Logo institucional" />
    <div class="spinner-border text-light mt-4" role="status">
        <span class="visually-hidden">Cargando…</span>
    </div>
</div>

<style>
    .arranque {
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(160deg, #07182e 0%, #0f3460 65%, #16213e 100%);
    }
</style>
