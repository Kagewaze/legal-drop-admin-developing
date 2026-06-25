import { useGlobalContext } from "../../utils/context";
import Autocomplete from "react-google-autocomplete";

export const SenderForm = () => {
  const {
    senderForm,
    setSenderForm,
    setSenderLongitude,
    setSenderLatitude,
    apiKey,
  } = useGlobalContext();

  function handlePlaceSelected(place) {
    setSenderForm({
      ...senderForm,
      senderAddress: place.formatted_address,
    });
    const location = place.geometry?.location;
    if (location) {
      setSenderLatitude(location.lat());
      setSenderLongitude(location.lng());
    }
  }

  const senderFormFields = [
    {
      id: 1,
      name: "senderName",
      label: "Sender Name ",
      type: "text",
      placeHolder: "Sender name",
      isRequired: true,
    },
    {
      id: 2,
      name: "senderPhone",
      label: "Sender Phone ",
      type: "text",
      placeHolder: "Sender phone",
      isRequired: true,
    },
    {
      id: 3,
      name: "senderEmail",
      label: "Sender Email ",
      type: "email",
      placeHolder: "Sender email",
      isRequired: false,
    },
    {
      id: 4,
      name: "senderAltPhone",
      label: "Sender Alt Phone ",
      type: "text",
      placeHolder: "Sender alt phone",
      isRequired: false,
    },
    {
      id: 5,
      name: "senderNote",
      label: "Sender Note ",
      type: "text",
      placeHolder: "Sender note",
      isRequired: false,
    },
    {
      id: 6,
      name: "vehicle",
      type: "select",
      placeHolder: "Select Vehicle",
      options: [
        { id: 0, text: "Car", value: "car" },
        { id: 1, text: "Van", value: "van" },
        { id: 2, text: "Truck", value: "truck" },
        { id: 3, text: "Bike", value: "bike" },
      ],
    },
    {
      id: 7,
      name: "paymentMethod",
      type: "select",
      placeHolder: "Select Payment type",
      options: [{ id: 0, text: "Card", value: "card" }],
    },
    {
      id: 8,
      name: "type",
      type: "select",
      placeHolder: "Select Type",
      options: [
        { id: 0, text: "Instant pickup", value: "instant_pickup" },
        { id: 1, text: "Scheduled pickup", value: "scheduled_pickup" },
      ],
    },
    senderForm.type === "scheduled_pickup" && {
      id: 9,
      name: "pickUpTime",
      label: "Pickup time",
      type: "datetime-local",
      placeHolder: "Pick up time",
      isRequired: true,
    },
    {
      id: 10,
      name: "section",
      type: "select",
      placeHolder: "Select section",
      options: [
        { id: 0, text: "medical supply", value: "medical_supply" },
        { id: 1, text: "legal document", value: "legal_document" },
        { id: 2, text: "grocery", value: "grocery" },
      ],
    },
    {
      id: 20,
      name: "price",
      label: "Price",
      type: "text",
      placeHolder: "Price",
      isRequired: true,
    },
  ].filter(Boolean);

  const handleSenderChange = (e) => {
    const { name, value } = e.target;
    setSenderForm({
      ...senderForm,
      [name]: value,
    });
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-primaryGreen mb-2">
        Sender Details
      </h2>
      {/* google autocomplete */}
      <div>
        <span className=" text-gray-900 font-medium text-sm mb-1">
          Sender Address
        </span>
        <Autocomplete
          onPlaceSelected={handlePlaceSelected}
          apiKey={apiKey}
          options={{
            types: ["geocode"], // Restrict to geographical locations
            componentRestrictions: { country: "ca" },
          }}
          className="google-address-input border-gray300 bg-transparent text-gray900 inline-block w-full border rounded-lg shadow-sm py-1 pl-2 globalInputRingGreen mb-4"
        />
      </div>
      <div className="flex gap-4 flex-col">
        {senderFormFields.map(
          ({ name, type, id, placeHolder, options, label, isRequired }) => (
            <div key={id}>
              {/* input */}
              {label && (
                <label className="text-gray-900 font-medium text-sm mb-1">
                  {label}
                  {!isRequired && (
                    <span className=" text-xs text-gray500">(optional)</span>
                  )}
                </label>
              )}
              {type !== "select" ? (
                <input
                  type={type}
                  name={name}
                  value={senderForm[name]}
                  onChange={handleSenderChange}
                  className={`border-gray300 bg-transparent shadow-sm text-gray900 inline-block w-full border rounded-lg py-1 pl-2 globalInputRingGreen`}
                  placeholder={placeHolder}
                  required={isRequired}
                />
              ) : (
                <select
                  name={name}
                  value={senderForm[name] || ""}
                  onChange={handleSenderChange}
                  className="border-gray300 bg-transparent shadow-sm inline-block w-full border rounded-lg py-1 pl-2 globalInputRingGreen"
                  required
                >
                  <option value="">{placeHolder}</option>
                  {options?.map(({ id, text, value }) => (
                    <option key={id} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};
