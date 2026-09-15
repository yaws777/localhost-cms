import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ParentDashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        // Fetch user info from local storage
        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
            setUserData(JSON.parse(storedUser));
        } else {
            // If no user is logged in, kick them back to login
            navigate('/');
        }
    }, [navigate]);

    if (!userData) return <div>Loading...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial' }}>
            <h1>Parent Dashboard</h1>
            <h2>Welcome, {userData.firstName} {userData.lastName}!</h2>
            <p>Your Parent ID is: {userData.id}</p>
            
            <button onClick={() => {
                localStorage.removeItem('user');
                navigate('/');
            }}>Logout</button>
        </div>
    );
}