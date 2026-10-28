package com.hearth.care.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hearth.care.application.GroceryService;
import com.hearth.care.dto.CareDtos.AddFoodRequest;
import com.hearth.care.dto.CareDtos.CustomItemRequest;
import com.hearth.care.dto.CareDtos.GroceryPatch;
import com.hearth.care.dto.CareDtos.GroceryTaskRequest;
import com.hearth.care.dto.CareDtos.GroceryView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class GroceryControllerTest {

    private MockMvc mvc;
    private GroceryService service;
    private ObjectMapper mapper;

    private final UUID itemId = UUID.randomUUID();
    private final UUID authorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = mock(GroceryService.class);
        mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        GroceryController controller = new GroceryController(service);
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private GroceryView sampleView(String name, int quantity, String unit, String status) {
        return new GroceryView(
                itemId,
                name,
                "Dairy & Eggs",
                quantity,
                unit,
                3.50,
                status,
                "milk",
                List.of(),
                "Calcium",
                authorId);
    }

    @Test
    @DisplayName("GET /api/v1/groceries returns list of groceries")
    void listReturnsAllGroceries() throws Exception {
        GroceryView milk = sampleView("Whole Milk", 2, "litres", "needed");
        GroceryView bread = sampleView("Sourdough Bread", 1, "loaf", "in-pantry");

        when(service.list()).thenReturn(List.of(milk, bread));

        mvc.perform(get("/api/v1/groceries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(itemId.toString()))
                .andExpect(jsonPath("$[0].name").value("Whole Milk"))
                .andExpect(jsonPath("$[0].quantity").value(2))
                .andExpect(jsonPath("$[0].status").value("needed"))
                .andExpect(jsonPath("$[1].name").value("Sourdough Bread"))
                .andExpect(jsonPath("$[1].status").value("in-pantry"));

        verify(service).list();
    }

    @Test
    @DisplayName("POST /api/v1/groceries creates custom grocery item")
    void addCustomCreatesItem() throws Exception {
        CustomItemRequest request = new CustomItemRequest("Organic Apples", 6, "pieces");
        GroceryView created = new GroceryView(
                itemId, "Organic Apples", "custom", 6, "pieces", 0.0, "needed", null, List.of(), null, authorId);

        when(service.addCustom(any(CustomItemRequest.class))).thenReturn(created);

        mvc.perform(post("/api/v1/groceries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(itemId.toString()))
                .andExpect(jsonPath("$.name").value("Organic Apples"))
                .andExpect(jsonPath("$.quantity").value(6));

        verify(service).addCustom(any(CustomItemRequest.class));
    }

    @Test
    @DisplayName("POST /api/v1/groceries/from-food creates item linked to catalogue food")
    void addFoodCreatesItem() throws Exception {
        AddFoodRequest request = new AddFoodRequest("spinach", List.of(authorId), List.of("iron"));
        GroceryView created = new GroceryView(
                itemId, "Baby Spinach", "Vegetables", 1, "pack", 2.20, "needed", "spinach", List.of(authorId.toString()), "iron", authorId);

        when(service.addFood(any(AddFoodRequest.class))).thenReturn(created);

        mvc.perform(post("/api/v1/groceries/from-food")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Baby Spinach"))
                .andExpect(jsonPath("$.foodId").value("spinach"));

        verify(service).addFood(any(AddFoodRequest.class));
    }

    @Test
    @DisplayName("PATCH /api/v1/groceries/{id} updates grocery item status")
    void updateModifiesItem() throws Exception {
        GroceryPatch patch = new GroceryPatch(4, "in-pantry");
        GroceryView updated = sampleView("Whole Milk", 4, "litres", "in-pantry");

        when(service.update(eq(itemId), any(GroceryPatch.class))).thenReturn(updated);

        mvc.perform(patch("/api/v1/groceries/" + itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(patch)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(4))
                .andExpect(jsonPath("$.status").value("in-pantry"));

        verify(service).update(eq(itemId), any(GroceryPatch.class));
    }

    @Test
    @DisplayName("DELETE /api/v1/groceries/{id} returns 204 No Content")
    void removeDeletesItem() throws Exception {
        mvc.perform(delete("/api/v1/groceries/" + itemId))
                .andExpect(status().isNoContent());

        verify(service).remove(itemId);
    }

    @Test
    @DisplayName("POST /api/v1/groceries/task dispatches shopping task to task-service")
    void createShoppingTaskDispatches() throws Exception {
        GroceryTaskRequest request = new GroceryTaskRequest(authorId, Instant.now());
        ObjectNode taskNode = JsonNodeFactory.instance.objectNode();
        taskNode.put("id", UUID.randomUUID().toString());
        taskNode.put("title", "Weekly Groceries");

        when(service.createShoppingTask(any(GroceryTaskRequest.class))).thenReturn(taskNode);

        mvc.perform(post("/api/v1/groceries/task")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Weekly Groceries"));

        verify(service).createShoppingTask(any(GroceryTaskRequest.class));
    }
}
