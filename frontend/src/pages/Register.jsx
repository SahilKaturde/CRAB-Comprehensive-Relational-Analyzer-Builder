import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo/CRAB_LOGO.png';
import { authService } from '../api/auth';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await authService.register(formData);
      setMessage('Account created! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-5 bg-crab-bg">
      <div className="flex justify-center mb-10 animate-fade-in">
        <div className="p-4 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,59,48,1)]">
          <img src={logo} alt="CRAB Logo" className="h-14 w-auto object-contain" />
        </div>
      </div>

      <div className="max-w-[480px] w-full animate-slide-up">
        <div className="brutalist-card p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-crab-accent"></div>
          
          <h1 className="text-4xl md:text-5xl font-black leading-[1] uppercase mb-2 -tracking-wider text-crab-text text-left">
            CREATE<br />
            ACCOUNT
          </h1>
          <p className="font-heading text-[10px] text-crab-accent mb-8 tracking-tighter text-left">JOIN CRAB ECOSYSTEM</p>
          
          <p className="font-mono text-[11px] font-bold text-black/40 uppercase mb-8 leading-relaxed tracking-widest text-left">
            Start your data analysis journey today.
          </p>

          <form className="flex flex-col gap-5" onSubmit={handleRegister}>
            {message && (
              <div className="p-3 bg-crab-accent/5 border-l-4 border-crab-accent font-mono text-[10px] font-black uppercase text-crab-accent animate-fade-in text-left">
                {message}
              </div>
            )}
            
            <div className="space-y-1.5 text-left">
              <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Username</label>
              <input 
                type="text" 
                name="username"
                placeholder="Unique identifier" 
                className="brutalist-input !py-3"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Email</label>
              <input 
                type="email" 
                name="email"
                placeholder="your@email.com" 
                className="brutalist-input !py-3"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Password</label>
                <input 
                  type="password" 
                  name="password"
                  placeholder="••••••••" 
                  className="brutalist-input !py-3"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Confirm</label>
                <input 
                  type="password" 
                  name="confirmPassword"
                  placeholder="••••••••" 
                  className="brutalist-input !py-3"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <button type="submit" className="brutalist-btn-primary" disabled={loading}>
                {loading ? 'PROCESSING...' : 'INITIALIZE ACCOUNT'}
              </button>
              <div className="text-center mt-2 font-mono text-[10px] font-bold uppercase text-black/40 tracking-widest">
                Already registered? <Link to="/login" className="text-crab-accent underline decoration-2 underline-offset-4">Access here</Link>
              </div>
            </div>
          </form>
        </div>
        
        <p className="mt-8 font-mono text-[9px] text-center text-black/30 uppercase tracking-[0.3em]">
          &copy; 2026 CRAB DATA SYSTEMS • SECURE ENROLLMENT
        </p>
      </div>
    </div>
  );
};

export default Register;
