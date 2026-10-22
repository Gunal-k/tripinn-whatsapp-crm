import Swal, { SweetAlertIcon } from 'sweetalert2';

/**
 * Tripinn Holidays Custom Dark Theme SweetAlert2 Instance
 */
export const TripinnSwal = Swal.mixin({
  background: '#0b132b',
  color: '#f1f5f9',
  buttonsStyling: false,
  customClass: {
    popup: '!bg-[#0b132b] !border !border-[#1e293b] !rounded-2xl !shadow-2xl !p-6',
    title: '!text-white !font-bold !text-base',
    htmlContainer: '!text-slate-300 !text-xs !leading-relaxed',
    confirmButton:
      'px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer mx-1.5 inline-flex items-center justify-center',
    cancelButton:
      'px-4 py-2.5 rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 font-semibold text-xs border border-[#1e293b] transition cursor-pointer mx-1.5 inline-flex items-center justify-center',
    actions: '!mt-5 !gap-2',
  },
});

/**
 * Display a non-blocking toast notification in the top-right corner
 */
export const showToast = (title: string, icon: SweetAlertIcon = 'success', timer = 3000) => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    background: '#0b132b',
    color: '#f1f5f9',
    customClass: {
      popup: '!bg-[#0b132b] !border !border-[#1e293b] !rounded-xl !shadow-2xl !p-3.5',
      title: '!text-xs !font-semibold !text-white !m-0',
      timerProgressBar: '!bg-emerald-400',
    },
  });
};

/**
 * Display a modal success alert
 */
export const showSuccessAlert = (title: string, text?: string) => {
  return TripinnSwal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonText: 'Great, Continue',
  });
};

/**
 * Display a modal error alert
 */
export const showErrorAlert = (title: string, text?: string) => {
  return TripinnSwal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Dismiss',
    customClass: {
      popup: '!bg-[#0b132b] !border !border-rose-500/30 !rounded-2xl !shadow-2xl !p-6',
      title: '!text-white !font-bold !text-base',
      htmlContainer: '!text-rose-200/90 !text-xs !leading-relaxed',
      confirmButton:
        'px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md transition cursor-pointer',
    },
  });
};

/**
 * Display a modal confirmation dialog (e.g. Sign out, archive, irreversible actions)
 */
export const showConfirmDialog = async ({
  title,
  text,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  isDanger = false,
  icon = 'warning' as SweetAlertIcon,
}: {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDanger?: boolean;
  icon?: SweetAlertIcon;
}): Promise<boolean> => {
  const result = await TripinnSwal.fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    customClass: {
      popup: '!bg-[#0b132b] !border !border-[#1e293b] !rounded-2xl !shadow-2xl !p-6',
      title: '!text-white !font-bold !text-base',
      htmlContainer: '!text-slate-300 !text-xs !leading-relaxed',
      confirmButton: isDanger
        ? 'px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition cursor-pointer mx-1.5'
        : 'px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer mx-1.5',
      cancelButton:
        'px-4 py-2.5 rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 font-semibold text-xs border border-[#1e293b] transition cursor-pointer mx-1.5',
    },
  });

  return result.isConfirmed;
};

export default TripinnSwal;
