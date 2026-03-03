import React from 'react';
import { Company } from '../../types';
import { dbService } from '../../services/dbService';

interface CompanyModalProps {
    isEditing: boolean;
    companyFormData: Omit<Company, 'createdAt'>;
    companies: Company[];
    showFeedback: (msg: string, type?: 'success' | 'error') => void;
    setCompanyFormData: (data: Omit<Company, 'createdAt'>) => void;
    setCompanies: (companies: Company[]) => void;
    onClose: () => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
    isEditing,
    companyFormData,
    companies,
    showFeedback,
    setCompanyFormData,
    setCompanies,
    onClose
}) => {
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const companyData: Company = {
                ...companyFormData,
                createdAt: isEditing
                    ? (companies.find(c => c.id === companyFormData.id)?.createdAt || new Date().toISOString())
                    : new Date().toISOString()
            };
            await dbService.saveCompany(companyData);
            if (isEditing) {
                setCompanies(companies.map(c => c.id === companyData.id ? companyData : c));
                showFeedback('Empresa actualizada');
            } else {
                setCompanies([...companies, companyData]);
                showFeedback('Empresa creada');
            }
            onClose();
        } catch (e: any) {
            showFeedback('Error al guardar empresa', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6 no-print">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl relative z-10 p-6 sm:p-10 animate-modal-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-4 mb-6 sm:mb-8">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shrink-0">
                        <i className="fas fa-building"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{isEditing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Configuración multiempresa</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Identificador (ID)</label>
                        <input
                            type="text"
                            disabled={isEditing}
                            value={companyFormData.id}
                            onChange={e => setCompanyFormData({ ...companyFormData, id: e.target.value })}
                            placeholder="Ej: LOGIS_SL"
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all disabled:opacity-50"
                            required
                        />
                    </div>

                    <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                        <input
                            type="text"
                            value={companyFormData.name}
                            onChange={e => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                            placeholder="Ej: Logística S.L."
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">CIF / NIF</label>
                        <input
                            type="text"
                            value={companyFormData.taxId}
                            onChange={e => setCompanyFormData({ ...companyFormData, taxId: e.target.value })}
                            placeholder="Ej: B12345678"
                            className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 transition-all"
                            required
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="submit"
                            className="w-full sm:flex-2 bg-slate-900 text-white py-4 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 order-1 sm:order-2 interactive-button"
                        >
                            {isEditing ? 'Guardar Cambios' : 'Crear Empresa'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all order-2 sm:order-1"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
