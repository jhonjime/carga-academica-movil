<script>
    import Swal from 'sweetalert2';

    let {
        api = $bindable(null),
        textoCancelar = 'Cancelar',
        colorConfirmar = '#0f3460'
    } = $props();

    const clases = { popup: 'rounded-4', confirmButton: 'rounded-3 px-4' };

    const alerta = (icon, title, text) =>
        Swal.fire({ icon, title, text, confirmButtonColor: colorConfirmar, customClass: clases });

    async function confirmar({
        titulo = '¿Estás seguro?',
        texto = 'Esta acción no se puede deshacer.',
        textoConfirmar = 'Sí, continuar',
        icono = 'warning',
        accion
    } = {}) {
        const { isConfirmed } = await Swal.fire({
            title: titulo,
            text: texto,
            icon: icono,
            showCancelButton: true,
            confirmButtonText: textoConfirmar,
            cancelButtonText: textoCancelar,
            confirmButtonColor: colorConfirmar,
            cancelButtonColor: '#6c757d',
            reverseButtons: true,
            focusCancel: true,
            customClass: { ...clases, cancelButton: 'rounded-3 px-4' }
        });
        if (isConfirmed) await accion?.();
        return isConfirmed;
    }

    const eliminar = ({ nombre = 'este registro', accion } = {}) =>
        confirmar({
            titulo: '¿Eliminar registro?',
            texto: `¿Estás seguro de que deseas eliminar ${nombre}? Esta acción no se puede deshacer.`,
            textoConfirmar: 'Sí, eliminar',
            accion
        });

    const exito = (m = 'La operación se realizó correctamente') => alerta('success', '¡Operación exitosa!', m);
    const error = (m = 'No fue posible completar la operación') => alerta('error', 'Ocurrió un error', m);

    $effect(() => {
        api = { confirmar, eliminar, exito, error };
    });
</script>