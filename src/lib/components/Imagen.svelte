<!-- src/lib/components/Imagen.svelte -->
<script>
    import logo from '$lib/img/cul67.png';

    let {
        src = logo,
        alt = 'Imagen institucional',
        ancho = '100%',
        alto = 'auto',
        clase = '',
        redonda = false
    } = $props();

    // Estado por si la imagen falla al cargar
    let errorCarga = $state(false);

    function manejarError() {
        errorCarga = true;
    }
</script>

<img
    src={errorCarga || !src ? logo : src}
    {alt}
    class="img-fluid {redonda ? 'rounded-circle' : 'rounded'} {clase}"
    style="width: {ancho}; height: {alto}; object-fit: cover;"
    onerror={manejarError}
/>