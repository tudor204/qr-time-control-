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
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md">
                <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter">Panel de Acceso</h2>
                <form onSubmit={onSubmit} className="space-y-4">
                    {isRegistering && (
                        <input
                            type="text"
                            placeholder="Nombre"
                            value={formData.name}
                            onChange={e => onChange('name', e.target.value)}
                            className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold"
                            required
                        />
                    )}
                    <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={e => onChange('email', e.target.value)}
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={formData.password}
                        onChange={e => onChange('password', e.target.value)}
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold"
                        required
                    />
                    <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg">
                        Entrar
                    </button>
                </form>
                <button
                    onClick={onToggleRegister}
                    className="w-full mt-6 text-[10px] text-gray-400 font-black uppercase"
                >
                    {isRegistering ? 'Ya tengo cuenta' : 'Crear nueva cuenta'}
                </button>
            </div>
        </div>
    );
};
