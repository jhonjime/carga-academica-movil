
<script>
    import Swal from 'sweetalert2';

    const COLOR = '#0f3460';
    const COLOR_PELIGRO = '#dc3545';


    const mostrar = (icon, titulo, texto = '') =>
        Swal.fire({
            icon,
            title: titulo,
            text: texto,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: COLOR
        });


    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });


    const mensajeDeError = (e, porDefecto = 'Ocurrió un error inesperado.') =>
        (typeof e === 'string' ? e : e?.message || e?.mensaje || e?.error) || porDefecto;

    export const exito = (titulo = '¡Listo!', texto = '') => mostrar('success', titulo, texto);
    export const error = (titulo = 'Error', texto = '') => mostrar('error', titulo, texto);
    export const advertencia = (titulo = 'Atención', texto = '') => mostrar('warning', titulo, texto);
    export const info = (titulo = 'Información', texto = '') => mostrar('info', titulo, texto);


    export const fallo = (e, titulo = 'Error') => mostrar('error', titulo, mensajeDeError(e));

    export const toastExito = (titulo) => Toast.fire({ icon: 'success', title: titulo });
    export const toastError = (titulo) => Toast.fire({ icon: 'error', title: titulo });
    export const toastInfo = (titulo) => Toast.fire({ icon: 'info', title: titulo });


    export const confirmar = async (
        titulo = '¿Estás seguro?',
        texto = '',
        { confirmar = 'Sí, continuar', cancelar = 'Cancelar', peligro = false } = {}
    ) => {
        const r = await Swal.fire({
            icon: peligro ? 'warning' : 'question',
            title: titulo,
            text: texto,
            showCancelButton: true,
            confirmButtonText: confirmar,
            cancelButtonText: cancelar,
            confirmButtonColor: peligro ? COLOR_PELIGRO : COLOR,
            reverseButtons: true
        });
        return r.isConfirmed;
    };


    export const cargando = (titulo = 'Procesando...') =>
        Swal.fire({
            title: titulo,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading()
        });

    export const cerrar = () => Swal.close();
</script>

