// Refactored dashboard layout

const Dashboard = () => {
    return (
        <div>
            {/* KPI strip at the top */}
            <div className="kpi-strip">
                {/* KPI components go here */}
            </div>

            {/* Action Now as primary dominant surface */}
            <div className="action-now">
                {/* Action components go here */}
            </div>

            {/* At Risk as secondary supporting surface */}
            <div className="at-risk">
                {/* At risk components go here */}
            </div>

            {/* System Insights below */}
            <div className="system-insights">
                {/* Insights components go here */}
            </div>
        </div>
    );
};

export default Dashboard;