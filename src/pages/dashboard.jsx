import { TbUsers } from "react-icons/tb";
import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa6";
import { useGlobalContext } from "../utils/context";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineClipboardDocumentCheck,
} from "react-icons/hi2";
import { MdPendingActions } from "react-icons/md";
import { PiMotorcycle } from "react-icons/pi";
import { RecentOrders } from "../components/orders/recentOrders";
import { useEffect, useState } from "react";
import customFetch from "../utils/customFetch";
import { toast } from "react-toastify";

export const Dashboard = () => {
  const { dispatch, setGlobalLoading } = useGlobalContext();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [dashboardStats, setDashboardStats] = useState([
    {
      id: 0,
      title: "Total Users",
      amount: "0",
      icon: <TbUsers size={15} className=" text-blue-700" />,
      link: "/users",
      backgroundColor: "#0057A2",
      navLinkId: 1,
    },
    {
      id: 1,
      title: "Total Orders",
      amount: "0",
      icon: (
        <HiOutlineClipboardDocumentList size={15} className=" text-blue-700" />
      ),
      link: "/orders",
      backgroundColor: "#AEC513",
      navLinkId: 2,
    },
    {
      id: 2,
      title: "Total Pending Orders",
      amount: "0",
      icon: <MdPendingActions size={15} className=" text-blue-700" />,
      link: "/orders",
      backgroundColor: "#003D71",
      navLinkId: 2,
    },
    {
      id: 4,
      title: "Total Completed Orders",
      amount: "0",
      icon: (
        <HiOutlineClipboardDocumentCheck size={15} className="text-blue-700" />
      ),
      link: "/orders",
      backgroundColor: "#001E40",
      navLinkId: 2,
    },
    {
      id: 3,
      title: "Total Riders",
      amount: "0",
      icon: <PiMotorcycle size={15} className=" text-blue-700" />,
      link: "/riders",
      backgroundColor: "#003111",
      navLinkId: 3,
    },
  ]);

  // Function to set default dates to the current month start and end
  const setDefaultDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(start.toISOString().split("T")[0]); // format YYYY-MM-DD
    setEndDate(end.toISOString().split("T")[0]); // format YYYY-MM-DD
  };

  async function fetchStats() {
    let url = "admin/stats";

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("End date cannot be earlier than start date");
      return;
    }

    const params = new URLSearchParams();

    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    if (params.toString()) url += `?${params.toString()}`;
    setGlobalLoading(true);

    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);

      const {
        totalUsers,
        totalOrders,
        totalPendingOrders,
        totalCompletedOrders,
        totalRiders,
      } = data;

      if (status === 200) {
        setGlobalLoading(false);

        const updatedStats = dashboardStats.map((stats) => {
          if (stats.id === 0) {
            return { ...stats, amount: totalUsers };
          } else if (stats.id === 1) {
            return { ...stats, amount: totalOrders };
          } else if (stats.id === 2) {
            return { ...stats, amount: totalPendingOrders };
          } else if (stats.id === 3) {
            return { ...stats, amount: totalRiders };
          } else if (stats.id === 4) {
            return { ...stats, amount: totalCompletedOrders };
          }
          return stats;
        });

        setDashboardStats(updatedStats);
      }
    } catch (error) {
      setGlobalLoading(false);
    }
  }

  function handleNavigation(id) {
    dispatch({
      type: "CLICK_NAV_LINK",
      payload: id,
    });
  }

  function handleClear() {
    setStartDate("");
    setEndDate("");
  }

  useEffect(() => {
    setDefaultDates();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  return (
    <section className=" px-4">
      <div className=" mb-8 flex flex-col gap-2">
        <p className=" text-sm md:text-base text-primaryGreen ">
          Filter stats by date:
        </p>
        <div className=" flex gap-4">
          <div>
            <p className=" text-xs font-medium">Start Date:</p>
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              className=" bg-transparent border rounded-md"
            />
          </div>
          <div>
            <p className=" text-xs font-medium">End Date:</p>
            <input
              type="date"
              value={endDate}
              className=" bg-transparent border rounded-md"
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className=" flex gap-2">
          {(startDate || endDate) && (
            <button
              onClick={handleClear}
              className=" border shadow-sm p-1 rounded-md px-2 hover:bg-blue-100 globalTransition text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <article className=" grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:w-full">
        {dashboardStats.map(
          ({ amount, backgroundColor, icon, id, title, link, navLinkId }) => (
            <div
              key={id}
              style={{
                backgroundColor: backgroundColor,
              }}
              className=" p-2 rounded-xl"
            >
              <p className=" flex justify-between mb-4">
                <span className={` font-semibold text-sm text-white`}>
                  {title}
                </span>
                <span className=" hidden bg-white w-[23px] h-[23px] md:grid place-items-center rounded-md">
                  {icon}
                </span>
              </p>
              {link ? (
                <Link
                  to={link}
                  onClick={() => handleNavigation(navLinkId)}
                  className={`globalTransition text-2xl font-semibold flex justify-between text-white items-center ${
                    id == 1
                      ? "hover:text-primaryGreen"
                      : "hover:text-primaryYellow"
                  }`}
                >
                  <span>{amount}</span>
                  <span>
                    <FaChevronRight size={10} />
                  </span>
                </Link>
              ) : (
                <p className=" text-2xl font-semibold text-white">{amount}</p>
              )}
            </div>
          )
        )}
      </article>
      <RecentOrders />
    </section>
  );
};
