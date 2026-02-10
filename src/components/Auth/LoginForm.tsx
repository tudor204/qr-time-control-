import React from 'react';

interface LoginFormProps {
    isRegistering: boolean;
    formData: { name: string; email: string; password: string };
    onSubmit: (e: React.FormEvent) => void;
    onChange: (field: 'name' | 'email' | 'password', value: string) => void;
    onToggleRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
    isRegistering,
    formData,
    onSubmit,
    onChange,
    onToggleRegister
}) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 selection:bg-blue-100 selection:text-blue-700">
            <div className="w-full max-w-md">
                {/* Logo o Icono Decorativo */}
                <div className="flex justify-center mb-8 animate-in fade-in zoom-in duration-700">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-200 rotate-3 hover:rotate-0 transition-transform duration-500">
                        <i className="fas fa-clock text-3xl text-white"></i>
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(37,99,235,0.1)] border border-white/50 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                            {isRegistering ? 'Crear Perfil' : 'Panel de Acceso'}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">
                            {isRegistering ? 'Regístrate para comenzar a fichar' : 'Bienvenido de nuevo al control horario'}
                        </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-5">
                        {isRegistering && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <i className="fas fa-user-tag text-xs"></i>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Tu nombre"
                                        value={formData.name}
                                        onChange={e => onChange('name', e.target.value)}
                                        className="w-full pl-11 p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Correo Electrónico</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <i className="fas fa-envelope text-xs"></i>
                                </div>
                                <input
                                    type="email"
                                    placeholder="ejemplo@correo.com"
                                    value={formData.email}
                                    onChange={e => onChange('email', e.target.value)}
                                    className="w-full pl-11 p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Contraseña</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <i className="fas fa-lock text-xs"></i>
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => onChange('password', e.target.value)}
                                    className="w-full pl-11 p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-600/20 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 active:scale-[0.98] focus:ring-4 focus:ring-blue-600/20 transition-all duration-200">
                            {isRegistering ? 'Registrarme' : 'Entrar'}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300 bg-white px-4">O</div>
                    </div>

                    <button
                        onClick={onToggleRegister}
                        className="w-full py-4 text-[11px] text-slate-500 font-bold uppercase tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                    >
                        {isRegistering ? 'Ya tengo cuenta' : 'Crear nueva cuenta'}
                    </button>
                </div>

                <p className="mt-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    &copy; 2026 QR Time Control &bull; v2.0
                </p>
            </div>
        </div>
    );
};
