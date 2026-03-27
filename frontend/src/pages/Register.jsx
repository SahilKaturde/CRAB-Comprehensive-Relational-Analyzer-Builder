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
    <div className="min-h-screen flex flex-col items-center py-10 px-5">
      <div className="flex justify-center mb-10">
        <img src={logo} alt="CRAB Logo" className="h-20 w-auto object-contain" />
      </div>

      <div className="max-w-[450px] w-full text-center">
        <h1 className="text-5xl font-black leading-[0.9] uppercase mb-5 text-left -tracking-wider text-[#1a1a1a]">
          CREATE<br />
          YOUR<br />
          <span className="font-heading text-3xl tracking-normal block mt-4 text-crab-accent">ACCOUNT</span>
        </h1>
        
        <p className="font-mono text-sm font-normal text-black text-left mb-8 leading-relaxed">
          Join the CRAB platform to analyze your CSV data with 
          advanced AI models and secure cloud storage.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleRegister}>
          {message && <div className="mb-4 font-extrabold text-crab-accent font-mono text-xs text-left">{message}</div>}
          
          <div className="text-left">
            <input 
              type="text" 
              name="username"
              placeholder="Username" 
              className="brutalist-input"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="text-left">
            <input 
              type="email" 
              name="email"
              placeholder="Email address" 
              className="brutalist-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="text-left">
            <input 
              type="password" 
              name="password"
              placeholder="Password" 
              className="brutalist-input"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="text-left">
            <input 
              type="password" 
              name="confirmPassword"
              placeholder="Confirm Password" 
              className="brutalist-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="mt-2 brutalist-btn-primary" disabled={loading}>
            {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="mt-5 font-semibold">
          Already have an account? <Link to="/login" className="text-crab-accent underline">Login here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
