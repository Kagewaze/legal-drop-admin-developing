import { useEffect, useState } from "react";
import { getFormattedDateTime } from "../../utils/dateTime";
import customFetch from "../../utils/customFetch";
import { useGlobalContext } from "../../utils/context";
import { useParams } from "react-router-dom";
import { EditModal } from "../editFormModal";
import { UpdateStatus } from "../updateStatus";
import { Orders } from "../../pages/orders";
import { ImageModal } from "../imageModal";

export const SingleRider = () => {
  const { setGlobalLoading } = useGlobalContext();
  const { singleRiderId } = useParams();
  const [showRiderUpdate, setShowRiderUpdate] = useState(false);
  const [showRiderEditModal, setRiderEditModal] = useState(false);
  const [imageData, setShowImageData] = useState("");
  const [showImage, setShowImage] = useState(false);

  const [rider, setRider] = useState({
    address: "",
    createdAt: "",
    deletedAt: null,
    dob: "",
    driver: {
      acceptanceRate: 0,
      activated: false,
      createdAt: "",
      deletedAt: null,
      homeAddress: "",
      id: "",
      kyc: null, // Changed to null as default
      location: "",
      overAllRating: "",
      readyToRide: false,
      ridingExperience: "",
      updatedAt: "",
      userId: "",
      vehicle: "",
      status: "",
    },
    email: "",
    emailVerified: false,
    firstName: "",
    id: "",
    lastName: "",
    location: "",
    phoneNumber: "",
    photoUrl: "",
    referralCode: "",
    role: "",
    status: "",
    updatedAt: "",
  });

  // Safe destructuring with default values
  const {
    address = "",
    dob = "",
    firstName = "",
    lastName = "",
    driver = {}, // Provide empty object as default
    email = "",
    emailVerified = false,
    id = "",
    location = "",
    phoneNumber = "",
    photoUrl = "",
    referralCode = "",
    role = "",
  } = rider;

  // Safely destructure nested driver object
  const {
    acceptanceRate = 0,
    activated = false,
    createdAt: driverCreatedAt = "",
    homeAddress = "",
    id: driverChildId = "",
    kyc = null, // Changed default to null
    location: driverChildLocation = "",
    overAllRating = "",
    readyToRide = false,
    ridingExperience = "",
    userId = "",
    vehicle: driverChildVehicle = "",
    status: driverStatus = "",
  } = driver;

  // Safely destructure kyc with null check
  const {
    licenseBack = "",
    licenseFront = "",
    vehicleRegistrationNo = "",
  } = kyc || {}; // Use empty object if kyc is null

  async function fetchSingleRider() {
    setGlobalLoading(true);
    const url = `admin/riders?id=${singleRiderId}`;
    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);

      if (status === 200) {
        setGlobalLoading(false);
        setRider(data[0] || rider);
      }
    } catch (error) {
      setGlobalLoading(false);
      console.error("Error fetching rider:", error);
    }
  }

  async function setDriverVerification(approved) {
    setGlobalLoading(true);
    try {
      await customFetch.patch(`admin/drivers/${id}/approve`, { approved });
      await fetchSingleRider();
    } catch (error) {
      setGlobalLoading(false);
      console.error("Error updating driver verification:", error);
    }
  }

  function handleClickImage(imgData) {
    setShowImage(true);
    setShowImageData(imgData);
  }

  useEffect(() => {
    fetchSingleRider();
  }, []);

  return (
    <>
      {showImage && (
        <ImageModal data={imageData} closeImgModal={setShowImage} />
      )}
      <section className="px-4">
        {showRiderUpdate && (
          <UpdateStatus
            routeTitle={"driver"}
            id={id}
            closeUpdateModal={setShowRiderUpdate}
            seeChangesFunction={fetchSingleRider}
          />
        )}
        {showRiderEditModal && (
          <EditModal
            closeEditModal={setRiderEditModal}
            userData={rider}
            routeTitle={"rider"}
            id={id}
            seeChangesFunction={fetchSingleRider}
          />
        )}
        <div className="flex justify-between items-center">
          <h1 className="font-semibold text-lg mb-4">Driver Details</h1>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <button
              onClick={() => setShowRiderUpdate(true)}
              className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
            >
              Update Status
            </button>
            <button
              onClick={() => setRiderEditModal(true)}
              className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
            >
              Edit
            </button>
            <button
              onClick={() => setDriverVerification(!activated)}
              className="border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
            >
              {activated ? "DEACTIVATE DRIVER" : "VERIFY DRIVER"}
            </button>
          </div>
        </div>
        <div className="mb-6 shadow-md p-2 py-4 rounded-md border bg-gray50">
          <h2 className="text-xl font-semibold text-black mb-4">
            Driver Information
          </h2>

          <div className="pl-4 grid md:grid-cols-2 gap-6 place-content-between text-sm md:text-base">
            <p className="h-[100px] w-[100px] border rounded-full border-primaryGreen">
              <img
                src={photoUrl || ""}
                alt="driver image"
                className="w-full h-full object-cover rounded-full"
              />
            </p>
            <p>
              <strong>DOB:</strong> {dob || "-"}
            </p>
            <p>
              <strong>First Name:</strong> {firstName || "-"}
            </p>
            <p>
              <strong>Last Name:</strong> {lastName || "-"}
            </p>
            <p>
              <strong>Email:</strong> {email || "-"}
            </p>
            <p>
              <strong>Email Verified:</strong>{" "}
              {emailVerified ? "True" : "False"}
            </p>
            <p>
              <strong>Location:</strong> {location || "-"}
            </p>
            <p>
              <strong>Phone Number:</strong> {phoneNumber || "-"}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span
                className={`ml-2 px-2 py-1 rounded ${
                  !driverStatus
                    ? "bg-yellow-200 text-yellow-700"
                    : "bg-green-200 text-green-700"
                }`}
              >
                {driverStatus || "-"}
              </span>
            </p>
            <p>
              <strong>Address:</strong> {address || "-"}
            </p>
            <p>
              <strong>Role:</strong> {role || "-"}
            </p>
            <p>
              <strong>Acceptance Rate:</strong> {acceptanceRate || "-"}
            </p>
            <p>
              <strong>Verification:</strong> {activated ? "Verified" : "Not Verified"}
            </p>
            <p>
              <strong>License Image:</strong>{" "}
              {licenseFront ? (
                <button
                  onClick={() => handleClickImage([licenseFront, licenseBack])}
                  className="text-primaryGreen font-semibold"
                >
                  click to view
                </button>
              ) : (
                "False"
              )}
            </p>
            <p>
              <strong>Home Address:</strong> {homeAddress || "-"}
            </p>
            <p>
              <strong>Vehicle Reg No:</strong> {vehicleRegistrationNo || "-"}
            </p>
            <p>
              <strong>Overall Rating:</strong> {overAllRating || "-"}
            </p>
            <p>
              <strong>Ready to ride:</strong> {readyToRide ? "Yes" : "No"}
            </p>
            <p>
              <strong>Riding Experience:</strong> {ridingExperience || "-"}
            </p>
            <p>
              <strong>Vehicle:</strong> {driverChildVehicle || "-"}
            </p>
            <p>
              <strong>Date Registered:</strong>{" "}
              {driverCreatedAt ? getFormattedDateTime(driverCreatedAt) : "-"}
            </p>
          </div>
        </div>
        <Orders fetchId={singleRiderId} riderKey={true} />
      </section>
    </>
  );
};
